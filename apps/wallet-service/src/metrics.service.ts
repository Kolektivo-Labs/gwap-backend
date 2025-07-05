// src/metrics/metrics.service.ts
import { Injectable, OnModuleInit } from '@nestjs/common';
import { collectDefaultMetrics, Counter, Registry } from 'prom-client';


export const globalRegistry = new Registry();

@Injectable()
export class MetricsService implements OnModuleInit {
    public readonly registry: Registry;
    public readonly walletDeployFailCounter: Counter;

    constructor() {
        this.registry = globalRegistry;

        collectDefaultMetrics({ register: this.registry });

        this.walletDeployFailCounter = new Counter({
            name: 'wallet_deploy_fail_total',
            help: 'Total number of failed wallet deployments',
            registers: [this.registry],
        });
    }

    onModuleInit() {
        
    }

    public async getMetrics(): Promise<string> {
        return await this.registry.metrics();
    }
}
