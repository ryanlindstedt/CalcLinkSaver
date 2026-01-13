# filename: deploy_backend_multiuser.py

import boto3
import json
import time
import zipfile
import io
import random
import string

# ======================================================================================
# SCRIPT CONFIGURATION
# ======================================================================================
# Generate a unique suffix to prevent resource name collisions
UNIQUE_SUFFIX = ''.join(random.choices(string.ascii_lowercase + string.digits, k=6))
BASE_NAME = "CalcLinkSaverMultiUser"

# Define resource names
ESTIMATES_TABLE_NAME = f"{BASE_NAME}Estimates-{UNIQUE_SUFFIX}"
USERS_TABLE_NAME = f"{BASE_NAME}Users-{UNIQUE_SUFFIX}"
ROLE_NAME = f"{BASE_NAME}LambdaRole-{UNIQUE_SUFFIX}"
POLICY_NAME = f"{BASE_NAME}DynamoDBPolicy-{UNIQUE_SUFFIX}"
FUNCTION_NAME = f"{BASE_NAME}Function-{UNIQUE_SUFFIX}"
API_NAME = f"{BASE_NAME}API-{UNIQUE_SUFFIX}"
API_STAGE_NAME = "prod"

# Get AWS Region and Account ID from the environment
try:
    session = boto3.Session()
    AWS_REGION = session.region_name
    ACCOUNT_ID = boto3.client('sts').get_caller_identity().get('Account')
    if not AWS_REGION:
        raise Exception("AWS Region not found. Please ensure you are running this in an environment with AWS credentials configured, like CloudShell.")
except Exception as e:
    print(f"Error getting AWS configuration: {e}")
    exit(1)

print(f"🚀  Starting deployment in region: {AWS_REGION}")
print(f"🔖  Unique suffix for this deployment: {UNIQUE_SUFFIX}\n")

# Initialize boto3 clients
iam_client = boto3.client('iam')
dynamodb_client = boto3.client('dynamodb')
lambda_client = boto3.client('lambda')
apigateway_client = boto3.client('apigateway')


# ======================================================================================
# LAMBDA FUNCTION HANDLER CODE
# ======================================================================================
lambda_handler_code = """
import boto3
import json
import os

# Get table names from environment variables
ESTIMATES_TABLE_NAME = os.environ.get('ESTIMATES_TABLE_NAME')
USERS_TABLE_NAME = os.environ.get('USERS_TABLE_NAME')

dynamodb = boto3.resource('dynamodb')
estimates_table = dynamodb.Table(ESTIMATES_TABLE_NAME)
users_table = dynamodb.Table(USERS_TABLE_NAME)

CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
    'Access-Control-Allow-Methods': 'OPTIONS,GET,POST,DELETE'
}

def get_user_from_apikey_id(api_key_id):
    \"\"\"Fetches user details from the UsersTable based on the API Key ID.\"\"\"
    try:
        response = users_table.get_item(Key={'apiKeyId': api_key_id})
        return response.get('Item')
    except Exception as e:
        print(f"Error looking up user for apiKeyId {api_key_id}: {e}")
        return None

def handler(event, context):
    try:
        # --- User Identification ---
        api_key_id = event.get('requestContext', {}).get('identity', {}).get('apiKeyId')
        if not api_key_id:
            return {'statusCode': 403, 'headers': CORS_HEADERS, 'body': json.dumps({'error': 'Forbidden: Missing API Key ID.'})}

        user = get_user_from_apikey_id(api_key_id)
        if not user:
            return {'statusCode': 403, 'headers': CORS_HEADERS, 'body': json.dumps({'error': f"Forbidden: No user found for the provided API Key."})}

        requester_id = user.get('userId')
        requester_name = user.get('displayName')

        http_method = event['httpMethod']
        path = event['path']

        # Handle CORS preflight requests
        if http_method == 'OPTIONS':
            return {'statusCode': 200, 'headers': CORS_HEADERS, 'body': ''}

        # --- Route: GET /estimates ---
        if http_method == 'GET' and path == '/estimates':
            response = estimates_table.scan()
            return {
                'statusCode': 200,
                'headers': CORS_HEADERS,
                'body': json.dumps(response.get('Items', []))
            }

        # --- Route: POST /estimates ---
        elif http_method == 'POST' and path == '/estimates':
            body = json.loads(event.get('body', '{}'))
            # The frontend sends 'id', we rename to 'estimateId' for clarity
            if 'id' not in body:
                 return {'statusCode': 400, 'headers': CORS_HEADERS, 'body': 'Missing required fields'}
            
            # Enrich item with owner info
            item_to_save = body.copy()
            item_to_save['estimateId'] = item_to_save.pop('id') # Rename key
            item_to_save['ownerId'] = requester_id
            item_to_save['ownerName'] = requester_name
            
            estimates_table.put_item(Item=item_to_save)
            return {'statusCode': 201, 'headers': CORS_HEADERS, 'body': 'Estimate saved'}

        # --- Route: DELETE /estimates/{id} ---
        elif http_method == 'DELETE' and event.get('pathParameters') and 'id' in event['pathParameters']:
            estimate_id_to_delete = event['pathParameters']['id']
            
            # Authorization Check
            item_response = estimates_table.get_item(Key={'estimateId': estimate_id_to_delete})
            item_to_delete = item_response.get('Item')

            if not item_to_delete:
                 return {'statusCode': 404, 'headers': CORS_HEADERS, 'body': 'Not Found'}

            if item_to_delete.get('ownerId') != requester_id:
                return {'statusCode': 403, 'headers': CORS_HEADERS, 'body': json.dumps({'error': 'Forbidden: You can only delete your own estimates.'})}

            # If authorized, proceed with deletion
            estimates_table.delete_item(Key={'estimateId': estimate_id_to_delete})
            return {'statusCode': 204, 'headers': CORS_HEADERS, 'body': ''}

        else:
            return {'statusCode': 404, 'headers': CORS_HEADERS, 'body': 'Not Found'}

    except Exception as e:
        print(f"Error: {e}")
        return {
            'statusCode': 500,
            'headers': CORS_HEADERS,
            'body': json.dumps({'error': str(e)})
        }
"""

def create_iam_role():
    """Creates the IAM Role and Policy for the Lambda function."""
    print("Step 1: Creating IAM Role and Policy...")
    trust_policy = json.dumps({
        "Version": "2012-10-17",
        "Statement": [{"Effect": "Allow", "Principal": {"Service": "lambda.amazonaws.com"}, "Action": "sts:AssumeRole"}]
    })
    try:
        role_response = iam_client.create_role(RoleName=ROLE_NAME, AssumeRolePolicyDocument=trust_policy)
        role_arn = role_response['Role']['Arn']
        print(f"  ✅ IAM Role '{ROLE_NAME}' created.")

        estimates_table_arn = f"arn:aws:dynamodb:{AWS_REGION}:{ACCOUNT_ID}:table/{ESTIMATES_TABLE_NAME}"
        users_table_arn = f"arn:aws:dynamodb:{AWS_REGION}:{ACCOUNT_ID}:table/{USERS_TABLE_NAME}"
        
        policy_document = json.dumps({
            "Version": "2012-10-17",
            "Statement": [
                {
                    "Effect": "Allow",
                    "Action": [
                        "dynamodb:Scan",
                        "dynamodb:GetItem",
                        "dynamodb:PutItem",
                        "dynamodb:DeleteItem"
                    ],
                    "Resource": estimates_table_arn
                },
                {
                    "Effect": "Allow",
                    "Action": "dynamodb:GetItem",
                    "Resource": users_table_arn
                }
            ]
        })
        iam_client.put_role_policy(RoleName=ROLE_NAME, PolicyName=POLICY_NAME, PolicyDocument=policy_document)
        print(f"  ✅ IAM Policy '{POLICY_NAME}' created and attached for both tables.")
        print("     Waiting for IAM propagation...")
        time.sleep(10)
        return role_arn
    except iam_client.exceptions.EntityAlreadyExistsException:
        print(f"  ⚠️  IAM Role '{ROLE_NAME}' already exists. Reusing.")
        return f"arn:aws:iam::{ACCOUNT_ID}:role/{ROLE_NAME}"
    except Exception as e:
        print(f"  ❌ Error creating IAM role: {e}")
        raise

def create_estimates_table():
    """Creates the DynamoDB table to store estimates."""
    print("\nStep 2: Creating Estimates DynamoDB Table...")
    try:
        dynamodb_client.create_table(
            TableName=ESTIMATES_TABLE_NAME,
            AttributeDefinitions=[{'AttributeName': 'estimateId', 'AttributeType': 'S'}],
            KeySchema=[{'AttributeName': 'estimateId', 'KeyType': 'HASH'}],
            BillingMode='PAY_PER_REQUEST'
        )
        waiter = dynamodb_client.get_waiter('table_exists')
        waiter.wait(TableName=ESTIMATES_TABLE_NAME)
        print(f"  ✅ DynamoDB Table '{ESTIMATES_TABLE_NAME}' is active.")
    except dynamodb_client.exceptions.ResourceInUseException:
        print(f"  ⚠️  Table '{ESTIMATES_TABLE_NAME}' already exists.")
    except Exception as e:
        print(f"  ❌ Error creating DynamoDB table: {e}")
        raise

def create_users_table():
    """Creates the DynamoDB table to map API Key IDs to Users."""
    print("\nStep 3: Creating Users DynamoDB Table...")
    try:
        dynamodb_client.create_table(
            TableName=USERS_TABLE_NAME,
            AttributeDefinitions=[{'AttributeName': 'apiKeyId', 'AttributeType': 'S'}],
            KeySchema=[{'AttributeName': 'apiKeyId', 'KeyType': 'HASH'}],
            BillingMode='PAY_PER_REQUEST'
        )
        waiter = dynamodb_client.get_waiter('table_exists')
        waiter.wait(TableName=USERS_TABLE_NAME)
        print(f"  ✅ DynamoDB Table '{USERS_TABLE_NAME}' is active.")
    except dynamodb_client.exceptions.ResourceInUseException:
        print(f"  ⚠️  Table '{USERS_TABLE_NAME}' already exists.")
    except Exception as e:
        print(f"  ❌ Error creating DynamoDB table: {e}")
        raise

def create_lambda_function(role_arn):
    """Creates and packages the Lambda function."""
    print("\nStep 4: Creating Lambda Function...")
    try:
        zip_buffer = io.BytesIO()
        with zipfile.ZipFile(zip_buffer, 'a', zipfile.ZIP_DEFLATED, False) as zf:
            zf.writestr('lambda_function.py', lambda_handler_code)
        zip_buffer.seek(0)
        response = lambda_client.create_function(
            FunctionName=FUNCTION_NAME,
            Runtime='python3.9',
            Role=role_arn,
            Handler='lambda_function.handler',
            Code={'ZipFile': zip_buffer.read()},
            Timeout=15,
            Environment={
                'Variables': {
                    'ESTIMATES_TABLE_NAME': ESTIMATES_TABLE_NAME,
                    'USERS_TABLE_NAME': USERS_TABLE_NAME
                }
            }
        )
        function_arn = response['FunctionArn']
        waiter = lambda_client.get_waiter('function_active_v2')
        waiter.wait(FunctionName=FUNCTION_NAME)
        print(f"  ✅ Lambda function '{FUNCTION_NAME}' created.")
        return function_arn
    except lambda_client.exceptions.ResourceConflictException:
        print(f"  ⚠️  Lambda function '{FUNCTION_NAME}' already exists. Skipping.")
        return f"arn:aws:lambda:{AWS_REGION}:{ACCOUNT_ID}:function/{FUNCTION_NAME}"
    except Exception as e:
        print(f"  ❌ Error creating Lambda function: {e}")
        raise

def create_api_gateway(function_arn):
    """Creates the REST API Gateway and integrates it with the Lambda function."""
    print("\nStep 5: Creating REST API Gateway...")
    try:
        # Create the REST API
        api_response = apigateway_client.create_rest_api(name=API_NAME)
        api_id = api_response['id']
        print(f"  ✅ REST API '{API_NAME}' created with ID: {api_id}")

        # Get the root resource ID
        root_resource_id = apigateway_client.get_resources(restApiId=api_id)['items'][0]['id']

        # Create the /estimates resource
        estimates_resource = apigateway_client.create_resource(restApiId=api_id, parentId=root_resource_id, pathPart='estimates')
        estimates_resource_id = estimates_resource['id']

        # Create the /{id} resource
        id_resource = apigateway_client.create_resource(restApiId=api_id, parentId=estimates_resource_id, pathPart='{id}')
        id_resource_id = id_resource['id']

        # Lambda Integration URI
        lambda_uri = f"arn:aws:apigateway:{AWS_REGION}:lambda:path/2015-03-31/functions/{function_arn}/invocations"

        # --- Setup Methods and Integrations ---
        resources = {
            estimates_resource_id: ['GET', 'POST', 'OPTIONS'],
            id_resource_id: ['DELETE', 'OPTIONS']
        }
        for resource_id, methods in resources.items():
            for method in methods:
                apigateway_client.put_method(
                    restApiId=api_id,
                    resourceId=resource_id,
                    httpMethod=method,
                    authorizationType='NONE',
                    apiKeyRequired=False if method == 'OPTIONS' else True
                )
                apigateway_client.put_integration(
                    restApiId=api_id,
                    resourceId=resource_id,
                    httpMethod=method,
                    type='AWS_PROXY',
                    integrationHttpMethod='POST',
                    uri=lambda_uri
                )
        print("  ✅ API Methods and Integrations created.")

        # Deploy the API
        apigateway_client.create_deployment(restApiId=api_id, stageName=API_STAGE_NAME)
        print(f"  ✅ API deployed to stage '{API_STAGE_NAME}'.")

        # Grant Lambda permission
        source_arn = f"arn:aws:execute-api:{AWS_REGION}:{ACCOUNT_ID}:{api_id}/*/*/*"
        lambda_client.add_permission(
            FunctionName=FUNCTION_NAME,
            StatementId=f'api-gateway-invoke-{UNIQUE_SUFFIX}',
            Action='lambda:InvokeFunction',
            Principal='apigateway.amazonaws.com',
            SourceArn=source_arn
        )
        print("  ✅ Granted API Gateway permission to invoke Lambda.")

        final_url = f"https://{api_id}.execute-api.{AWS_REGION}.amazonaws.com/{API_STAGE_NAME}/estimates"
        return api_id, final_url
    except Exception as e:
        print(f"  ❌ Error creating API Gateway: {e}")
        raise

def create_usage_plan(api_id):
    """Creates a Usage Plan and associates it with the API Stage."""
    print("\nStep 6: Creating API Gateway Usage Plan...")
    try:
        plan_name = f'{BASE_NAME}-UsagePlan-{UNIQUE_SUFFIX}'
        plan_response = apigateway_client.create_usage_plan(
            name=plan_name,
            description='Limits usage for the CalcLinkSaver API',
            apiStages=[{'apiId': api_id, 'stage': API_STAGE_NAME}],
            throttle={'rateLimit': 10, 'burstLimit': 5},
            quota={'limit': 5000, 'period': 'MONTH'}
        )
        print(f"  ✅ Usage Plan '{plan_name}' created and associated with the API.")
    except Exception as e:
        print(f"  ❌ Error creating Usage Plan: {e}")
        raise

if __name__ == "__main__":
    try:
        role_arn = create_iam_role()
        create_estimates_table()
        create_users_table()
        function_arn = create_lambda_function(role_arn)
        api_id, final_url = create_api_gateway(function_arn)
        create_usage_plan(api_id) # Added this step back in

        print("\n" + "="*70)
        print("🎉 SUCCESS! Your AWS backend infrastructure has been deployed. 🎉")
        print("="*70)
        print("\nAll infrastructure, including the API Usage Plan, is now ready.")
        print("You can now add users by running the 'add_user.py' script.")
        
        print("\nTo add your first user, run this command:")
        print("python3 add_user.py")

        print("\n" + "-"*70)
        print("\nEach user will need the following API URL:")
        print(f"\n  ➡️   API URL: {final_url}\n")


    except Exception as e:
        print("\n" + "="*60)
        print("🔥 DEPLOYMENT FAILED 🔥")
        print(f"An error occurred: {e}")
        print("Please check the error messages above. You may need to manually clean up created resources from the AWS console.")
        print("="*60)
