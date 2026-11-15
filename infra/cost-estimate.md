# Estimated monthly cost (ap-south-1, continuous)

Assumptions: 1x Fargate task 0.5 vCPU / 1 GB ARM64, 1x Application Load Balancer
(Express Mode), RDS PostgreSQL `db.t4g.micro` 20 GB gp3 encrypted, no NAT Gateway
(default VPC public subnets + task public IP), 2 Secrets Manager secrets, light logs.

| Resource | Est. USD/mo |
|----------|-------------|
| ALB (Express Mode) base + light LCU | 18-24 |
| Fargate 0.5 vCPU / 1 GB ARM64 24x7 | 8-12 |
| RDS db.t4g.micro + 20 GB gp3 encrypted | 12-15 |
| Secrets Manager (2 secrets) | 0.80 |
| ECR storage + CloudWatch Logs | 2-4 |
| **Total** | **~41-56** |

Hard limit: $60/mo. Estimate is under the limit → proceed.

Not included: NAT Gateway (~$32/mo) — intentionally avoided.
Data transfer beyond light ALB/API traffic may add a few dollars.
