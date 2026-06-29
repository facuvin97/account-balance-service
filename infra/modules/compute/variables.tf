variable "project_name" {
  type = string
}

variable "environment" {
  type = string
}

variable "aws_region" {
  type = string
}

variable "container_port" {
  type = number
}

variable "fargate_cpu" {
  type = number
}

variable "fargate_memory" {
  type = number
}

variable "desired_count" {
  type = number
}

variable "vpc_id" {
  type = string
}

variable "public_subnet_ids" {
  type = list(string)
}

variable "private_subnet_ids" {
  type = list(string)
}

variable "alb_security_group_id" {
  type = string
}

variable "ecs_security_group_id" {
  type = string
}

variable "acm_certificate_arn" {
  type = string
}

variable "jwt_secret_arn" {
  description = "ARN del secreto JWT en Secrets Manager"
  type        = string
}

variable "db_credentials_secret_arn" {
  description = "ARN del secreto de credenciales DB en Secrets Manager"
  type        = string
}

variable "ssm_db_host_arn" {
  type = string
}

variable "ssm_db_port_arn" {
  type = string
}

variable "ssm_db_name_arn" {
  type = string
}

variable "image_tag" {
  description = "Container image tag (use git SHA for immutable deploys)"
  type        = string
}
