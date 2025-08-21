// src/currencies/currencies.controller.ts
import { Controller, Get } from '@nestjs/common';
import { CurrenciesService } from './currencies.service';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('Currencies')
@Controller('currencies')
export class CurrenciesController {
  constructor(private readonly currenciesService: CurrenciesService) {}

  @Get()
  @ApiOperation({
    summary: 'Lister toutes les devises disponibles sur la plateforme',
  })
  findAll() {
    return this.currenciesService.findAll();
  }
}
