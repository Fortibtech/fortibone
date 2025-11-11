import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { User } from '@prisma/client';
import { InvoicingService } from './invoicing.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { AddInvoicePaymentDto } from './dto/add-invoice-payment.dto';

@ApiTags('Invoicing')
@Controller()
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class InvoicingController {
  constructor(private readonly invoicingService: InvoicingService) {}

  @Post('orders/:orderId/invoice')
  @ApiOperation({
    summary: 'Générer une facture pour une commande (Owner requis)',
  })
  @ApiResponse({ status: 201, description: 'Facture créée avec succès.' })
  createInvoice(
    @Param('orderId') orderId: string,
    @Request() req: { user: User },
    @Body() dto: CreateInvoiceDto,
  ) {
    return this.invoicingService.createInvoiceForOrder(
      orderId,
      req.user.id,
      dto,
    );
  }

  @Get('orders/:orderId/invoice')
  @ApiOperation({ summary: "Obtenir la facture d'une commande (Owner requis)" })
  @ApiResponse({ status: 200, description: 'Détails de la facture.' })
  @ApiResponse({
    status: 404,
    description: 'Aucune facture trouvée pour cette commande.',
  })
  findInvoice(
    @Param('orderId') orderId: string,
    @Request() req: { user: User },
  ) {
    return this.invoicingService.findInvoiceByOrder(orderId, req.user.id);
  }

  @Post('invoices/:invoiceId/payments')
  @ApiOperation({ summary: 'Ajouter un paiement à une facture (Owner requis)' })
  @ApiResponse({ status: 201, description: 'Paiement ajouté avec succès.' })
  addPayment(
    @Param('invoiceId') invoiceId: string,
    @Request() req: { user: User },
    @Body() dto: AddInvoicePaymentDto,
  ) {
    return this.invoicingService.addPaymentToInvoice(
      invoiceId,
      req.user.id,
      dto,
    );
  }
}
