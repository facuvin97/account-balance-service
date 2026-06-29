output "db_endpoint" {
  description = "Endpoint de conexion a RDS (host:port)"
  value       = aws_db_instance.main.endpoint
}

output "db_address" {
  description = "Hostname de RDS (sin puerto)"
  value       = aws_db_instance.main.address
}
