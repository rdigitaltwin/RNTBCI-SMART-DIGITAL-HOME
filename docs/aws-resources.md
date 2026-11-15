# AWS resources (ap-south-1) — Project=migration

Stack: `rntbci-migration` (CloudFormation)

| Resource | Identifier |
|----------|------------|
| ECR | `148395525846.dkr.ecr.ap-south-1.amazonaws.com/myapp` |
| RDS | `rntbci-postgres` (`db.t4g.micro`, 20 GB gp3, encrypted, private) |
| RDS endpoint | `rntbci-postgres.cfwq2kw2a3dy.ap-south-1.rds.amazonaws.com:5432` |
| DB name | `rntbci` |
| App secret | `rntbci/app` |
| Task execution role | `rntbci-ecs-task-execution` |
| Task role | `rntbci-ecs-task` |
| Express infra role | `ecsInfrastructureRoleForExpressServices` |
| GitHub OIDC deploy role | `rntbci-github-deploy` |
| VPC | `vpc-08279b44467343a67` (default) |
| RDS SG | `sg-0f667dca1c254b72f` |

## Estimated monthly cost

See `infra/cost-estimate.md` — about **$41–56/mo** (under $60 hard limit). No NAT Gateway.

## Notes

- Free-tier account: RDS `BackupRetentionPeriod` set to **1** day (7 was rejected).
- ECS Express Mode service created after first image push (see workflow / deploy notes).
- Railway and Vercel remain live until explicit cutover.
