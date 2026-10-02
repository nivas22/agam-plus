import { Injectable } from '@nestjs/common';
import { DemoRequestRepository } from '../repositories/demo-request.repository';

@Injectable()
export class DemoRequestsService {
  constructor(private readonly demoRequestRepository: DemoRequestRepository) {}

  create(data: {
    hospitalName: string;
    contactName: string;
    phone: string;
    email?: string;
    city?: string;
    doctorCount?: number;
    message?: string;
  }) {
    return this.demoRequestRepository.create(data);
  }
}
