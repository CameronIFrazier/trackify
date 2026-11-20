import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as s3 from 'aws-cdk-lib/aws-s3';

export class InfraStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // The VPC — your isolated network. Aurora lives inside this.
    const vpc = new ec2.Vpc(this, 'TrackifyVpc', {
      maxAzs: 2, // spread across 2 Availability Zones for resilience
      natGateways: 0, // IMPORTANT: keep this 0 — NAT gateways cost ~$32/mo each
      subnetConfiguration: [
        {
          name: 'public',
          subnetType: ec2.SubnetType.PUBLIC,
          cidrMask: 24,
        },
        {
          name: 'private',
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
          cidrMask: 24,
        },
      ],
    });

    const dbCluster = new rds.DatabaseCluster(this, 'TrackifyDb', {
      enableDataApi: true,
  engine: rds.DatabaseClusterEngine.auroraPostgres({
     version: rds.AuroraPostgresEngineVersion.of('16.8', '16'),
  }),
  vpc,
  vpcSubnets: {
    subnetType: ec2.SubnetType.PRIVATE_ISOLATED, // DB in the walled-off subnets
  },
  serverlessV2MinCapacity: 0.5, // keep a small instance always warm — no cold-start pause on login
  serverlessV2MaxCapacity: 1,   // cap it low so a runaway can't cost much
  writer: rds.ClusterInstance.serverlessV2('writer'),
  defaultDatabaseName: 'trackify',
});

    // Private bucket for user-uploaded food photos. Objects are never public —
    // the app reads and writes them only through short-lived presigned URLs the
    // Lambda signs. CORS lets the web app's browser do the PUT/GET directly.
    const foodPhotoBucket = new s3.Bucket(this, 'TrackifyFoodPhotos', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      cors: [
        {
          allowedMethods: [s3.HttpMethods.PUT, s3.HttpMethods.GET],
          allowedOrigins: ['*'], // the presigned signature is the real auth
          allowedHeaders: ['*'],
          maxAge: 3000,
        },
      ],
      // Keep user photos even if the stack is torn down.
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // The bucket name to paste into the Lambda's PHOTO_BUCKET env var.
    new cdk.CfnOutput(this, 'FoodPhotoBucketName', {
      value: foodPhotoBucket.bucketName,
    });

    
  }

  
}