terraform {
  required_version = ">= 1.5"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # Backend remoto deshabilitado — en producción se usaría S3 + DynamoDB para state locking
  # backend "s3" {
  #   bucket         = "my-terraform-state"
  #   key            = "account-balance-service/terraform.tfstate"
  #   region         = "us-east-1"
  #   dynamodb_table = "terraform-locks"
  #   encrypt        = true
  # }
}

provider "aws" {
  region = var.aws_region
}
