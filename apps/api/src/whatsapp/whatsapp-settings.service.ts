import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WhatsappConfigRepository } from '../repositories/whatsapp-config.repository';
import { AuditService } from '../audit/audit.service';
import { ApiError } from '../common/errors/api-error';
import { HospitalUserProfile } from '../auth/decorators/current-user.decorator';
import { graphApiBase } from './whatsapp.constants';

interface MetaPhoneNumber {
  display_phone_number?: string;
  verified_name?: string;
}

@Injectable()
export class WhatsappSettingsService {
  private readonly logger = new Logger(WhatsappSettingsService.name);

  constructor(
    private readonly whatsappConfigRepository: WhatsappConfigRepository,
    private readonly auditService: AuditService,
    private readonly config: ConfigService,
  ) {}

  async getStatus(hospitalId: string) {
    const config = await this.whatsappConfigRepository.getByHospitalId(hospitalId);
    if (!config) return { connected: false, assigned: false };

    // Credentials are never returned.
    return {
      assigned: true,
      connected: Boolean(config.connected),
      phoneNumberId: config.phoneNumberId,
      wabaId: config.wabaId,
      businessPhoneNumber: config.businessPhoneNumber,
      verifiedName: config.verifiedName,
      connectedAt: config.connectedAt,
      disconnectedAt: config.disconnectedAt,
    };
  }

  // Embedded Signup will supply these from Meta's popup; until then a hospital
  // admin copies them out of their own Meta app dashboard.
  async connectOwnAccount(
    hospitalId: string,
    actor: HospitalUserProfile,
    input: { phoneNumberId: string; wabaId: string; accessToken: string },
  ) {
    const existing = await this.whatsappConfigRepository.getByPhoneNumberId(
      input.phoneNumberId,
    );
    if (existing && existing.hospitalId !== hospitalId) {
      throw ApiError.conflict(
        'That number is already connected to another hospital',
      );
    }

    // Checks the token and the number together, so a bad pairing fails now
    // rather than silently on the first patient message.
    const details = await this.fetchNumberDetails(
      input.phoneNumberId,
      input.accessToken,
    );

    await this.whatsappConfigRepository.saveHospitalCredentials(hospitalId, {
      phoneNumberId: input.phoneNumberId,
      wabaId: input.wabaId,
      accessToken: input.accessToken,
      businessPhoneNumber: details.display_phone_number,
      verifiedName: details.verified_name,
      connectedBy: actor.userId,
    });

    await this.auditService.log({
      hospitalId,
      actor: { userId: actor.userId, name: actor.name, role: actor.role },
      action: 'whatsapp.connected',
      area: 'settings',
      summary: `Connected WhatsApp number ${details.display_phone_number ?? input.phoneNumberId}`,
    });

    return this.getStatus(hospitalId);
  }

  async setEnabled(
    hospitalId: string,
    actor: HospitalUserProfile,
    enabled: boolean,
  ) {
    const config = await this.whatsappConfigRepository.getByHospitalId(hospitalId);
    if (!config) {
      throw ApiError.notFound('WhatsApp is not connected for this hospital');
    }

    await this.whatsappConfigRepository.setConnected(hospitalId, enabled);

    await this.auditService.log({
      hospitalId,
      actor: { userId: actor.userId, name: actor.name, role: actor.role },
      action: enabled ? 'whatsapp.enabled' : 'whatsapp.disabled',
      area: 'settings',
      summary: `${enabled ? 'Enabled' : 'Disabled'} WhatsApp on ${config.businessPhoneNumber ?? config.phoneNumberId}`,
    });

    return this.getStatus(hospitalId);
  }

  async disconnect(hospitalId: string, actor: HospitalUserProfile) {
    const config = await this.whatsappConfigRepository.getByHospitalId(hospitalId);
    if (!config) throw ApiError.notFound('WhatsApp is not connected');

    // Removed outright, so the stored access token does not outlive the
    // hospital's decision to disconnect.
    await this.whatsappConfigRepository.deleteForHospital(hospitalId);

    await this.auditService.log({
      hospitalId,
      actor: { userId: actor.userId, name: actor.name, role: actor.role },
      action: 'whatsapp.disconnected',
      area: 'settings',
      summary: `Disconnected WhatsApp number ${config.businessPhoneNumber ?? config.phoneNumberId}`,
    });

    return this.getStatus(hospitalId);
  }

  private async fetchNumberDetails(
    phoneNumberId: string,
    accessToken: string,
  ): Promise<MetaPhoneNumber> {
    let response: Response;
    try {
      response = await fetch(
        `${graphApiBase(this.config)}/${phoneNumberId}?fields=display_phone_number,verified_name`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
    } catch (error) {
      this.logger.error('Could not reach WhatsApp', error as Error);
      throw ApiError.badRequest('Could not reach WhatsApp — try again');
    }

    if (!response.ok) {
      const body = await response.text();
      this.logger.warn(`WhatsApp rejected these credentials: ${body}`);
      throw ApiError.badRequest(
        'WhatsApp rejected these details — check the phone number ID and access token',
      );
    }

    return response.json();
  }
}
