import { Injectable } from '@nestjs/common';
import { WhatsappEnquiryRepository } from '../repositories/whatsapp-enquiry.repository';
import { ApiError } from '../common/errors/api-error';
import { HospitalUserProfile } from '../auth/decorators/current-user.decorator';
import { WHATSAPP_ENQUIRY_STATUS } from '../constants';

@Injectable()
export class WhatsappEnquiriesService {
  constructor(
    private readonly whatsappEnquiryRepository: WhatsappEnquiryRepository,
  ) {}

  async list(hospitalId: string, status?: string) {
    const valid = Object.values(WHATSAPP_ENQUIRY_STATUS) as string[];
    if (status && !valid.includes(status)) {
      throw ApiError.badRequest('Invalid enquiry status filter');
    }
    return this.whatsappEnquiryRepository.listByHospital(hospitalId, status);
  }

  async resolve(
    hospitalId: string,
    enquiryId: string,
    actor: HospitalUserProfile,
  ) {
    const enquiry = await this.whatsappEnquiryRepository.resolve(
      hospitalId,
      enquiryId,
      actor.userId,
    );
    if (!enquiry) throw ApiError.notFound('Enquiry not found');
    return enquiry;
  }
}
