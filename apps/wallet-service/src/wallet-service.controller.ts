import { Controller, Post, Body, BadRequestException } from '@nestjs/common';
import { WalletService } from './wallet-service.service';
import { AddWalletRequestDto } from './dto/add-wallet.dto';
import { AddWalletResponseDto } from './dto/add-wallet.dto';

@Controller()
export class WalletServiceController {
  constructor(private readonly walletService: WalletService) { }

  @Post('addWallet')
  async addWallet(
    @Body() body: AddWalletRequestDto
  ): Promise<{ message: string; data: AddWalletResponseDto }> {
    const { email = null, accountId = null } = body;

    try {
      const result = await this.walletService.addWallet({ email, accountId });
      return {
        message: 'Wallet agregada correctamente',
        data: result,
      };
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }
}
