import { Controller, Post, Body, BadRequestException, Get } from '@nestjs/common';
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
    const { email = null, accountId = null, userId = null } = body;

    try {
      const result = await this.walletService.addWallet({ email, accountId, userId });
      return {
        message: 'Success',
        data: result,
      };
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  @Get()
  getHello() {
    return { message: 'Wallet-service is alive' };
  }
}
