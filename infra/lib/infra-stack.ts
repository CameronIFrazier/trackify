import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';


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
  engine: rds.DatabaseClusterEngine.auroraPostgres({
     version: rds.AuroraPostgresEngineVersion.of('16.8', '16'),
  }),
  vpc,
  vpcSubnets: {
    subnetType: ec2.SubnetType.PRIVATE_ISOLATED, // DB in the walled-off subnets
  },
  serverlessV2MinCapacity: 0,   // scale to zero when idle (pay ~$0 compute)
  serverlessV2MaxCapacity: 1,   // cap it low so a runaway can't cost much
  writer: rds.ClusterInstance.serverlessV2('writer'),
  defaultDatabaseName: 'trackify',
});

    
  }

  
}