import { Test, TestingModule } from '@nestjs/testing';
import { InvoicingService } from './invoicing.service';

describe('InvoicingService', () => {
  let service: InvoicingService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [InvoicingService],
    }).compile();

    service = module.get<InvoicingService>(InvoicingService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
