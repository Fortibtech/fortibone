import { Test, TestingModule } from '@nestjs/testing';
import { InvoicingController } from './invoicing.controller';

describe('InvoicingController', () => {
  let controller: InvoicingController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [InvoicingController],
    }).compile();

    controller = module.get<InvoicingController>(InvoicingController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
