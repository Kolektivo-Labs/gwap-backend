export class AddWalletRequestDto {
    email?: string | null;
    accountId?: string | null;
}
export class AddWalletResponseDto {
    email: string | null;
    accountId: string | null;
    proxy: string;
}
