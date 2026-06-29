output "alb_dns_name" {
  description = "DNS del Application Load Balancer — punto de entrada al servicio"
  value       = module.compute.alb_dns_name
}

output "ecr_repository_url" {
  description = "URL del repositorio ECR para push de imágenes"
  value       = module.compute.ecr_repository_url
}

output "rds_endpoint" {
  description = "Endpoint de conexión a RDS (host:port)"
  value       = module.database.db_endpoint
}

output "vpc_id" {
  description = "ID de la VPC"
  value       = module.network.vpc_id
}
