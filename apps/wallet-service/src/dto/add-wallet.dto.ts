export class AddWalletRequestDto {
    email?: string | null;
    accountId?: string | null;
    userId?: string | null;
}
export class AddWalletResponseDto {
    email: string;
    accountId: string;
    userId: string
    address: string;
    createdChainIds: string[]
    errorChainIds: string[]
}
