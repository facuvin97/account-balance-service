output "jwt_secret_arn" {
  value = aws_secretsmanager_secret.jwt_secret.arn
}

output "db_credentials_secret_arn" {
  value = aws_secretsmanager_secret.db_credentials.arn
}

output "ssm_db_port_arn" {
  value = aws_ssm_parameter.db_port.arn
}

output "ssm_db_name_arn" {
  value = aws_ssm_parameter.db_name.arn
}
