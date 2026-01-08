# filename: add_user.py
# description: A script to simplify adding new users to the CalcLinkSaver backend.

import boto3
import uuid
import re

# ======================================================================================
# SCRIPT CONFIGURATION
# ======================================================================================
# This is the base name used in the deployment script. The script will find resources
# that start with this name.
BASE_NAME = "CalcLinkSaverMultiUser"

try:
    # Initialize boto3 clients
    session = boto3.Session()
    AWS_REGION = session.region_name
    apigateway_client = boto3.client('apigateway')
    dynamodb_client = boto3.client('dynamodb')
    if not AWS_REGION:
        raise Exception("AWS Region not found. Please ensure your environment is configured with AWS credentials.")
except Exception as e:
    print(f"Error initializing AWS clients: {e}")
    exit(1)

# ======================================================================================
# HELPER FUNCTIONS TO FIND AND SELECT DEPLOYMENTS
# ======================================================================================

def find_deployments():
    """Finds all complete deployments and their associated resources."""
    print(f"🔎 Searching for all deployments starting with '{BASE_NAME}'...")
    deployments = {}

    try:
        # 1. Find all APIs and group them by suffix
        api_response = apigateway_client.get_rest_apis()
        for item in api_response.get('items', []):
            if item['name'].startswith(BASE_NAME):
                # Extract suffix (e.g., 'abcdef' from 'CalcLinkSaverMultiUserAPI-abcdef')
                parts = item['name'].split('-')
                if len(parts) > 1:
                    suffix = parts[-1]
                    api_id = item['id']
                    invoke_url = f"https://{api_id}.execute-api.{AWS_REGION}.amazonaws.com/prod/estimates"
                    deployments[suffix] = {
                        'api_name': item['name'],
                        'api_id': api_id,
                        'api_url': invoke_url,
                        'suffix': suffix
                    }

        # 2. Find all user tables and match them to deployments
        table_response = dynamodb_client.list_tables()
        for table_name in table_response.get('TableNames', []):
            if table_name.startswith(BASE_NAME) and 'Users' in table_name:
                parts = table_name.split('-')
                if len(parts) > 1:
                    suffix = parts[-1]
                    if suffix in deployments:
                        deployments[suffix]['users_table_name'] = table_name

        # 3. Find usage plans and match them to deployments
        plan_response = apigateway_client.get_usage_plans()
        for item in plan_response.get('items', []):
            for stage in item.get('apiStages', []):
                for suffix, deployment_info in deployments.items():
                    if stage.get('apiId') == deployment_info['api_id']:
                        deployment_info['usage_plan_id'] = item['id']
                        deployment_info['usage_plan_name'] = item['name']

        # 4. Filter out any incomplete deployments
        complete_deployments = {s: d for s, d in deployments.items() if 'users_table_name' in d and 'usage_plan_id' in d}
        
        return list(complete_deployments.values())

    except Exception as e:
        print(f"  ❌ Error searching for deployments: {e}")
        return []

def select_deployment(deployments):
    """Prompts the user to select a deployment if more than one is found."""
    if not deployments:
        print("\n❌ CRITICAL: No complete deployments found. Please ensure the backend has been deployed correctly.")
        return None

    if len(deployments) == 1:
        print(f"  ✅ Automatically selected the only available deployment: '{deployments[0]['api_name']}'")
        return deployments[0]

    print("\nMultiple deployments found. Please select which one to add the user to:")
    for i, dep in enumerate(deployments):
        print(f"  {i+1}) {dep['api_name']} (Suffix: {dep['suffix']})")

    while True:
        try:
            choice = int(input("Enter selection number: ")) - 1
            if 0 <= choice < len(deployments):
                return deployments[choice]
            else:
                print("Invalid number. Please try again.")
        except ValueError:
            print("Invalid input. Please enter a number.")


# ======================================================================================
# MAIN EXECUTION
# ======================================================================================

if __name__ == "__main__":
    print("==============================================")
    print("== CalcLinkSaver User Addition Utility ==")
    print("==============================================\n")

    # 1. Find and select the target deployment
    all_deployments = find_deployments()
    selected_deployment = select_deployment(all_deployments)

    if not selected_deployment:
        exit(1)

    # Extract resource IDs from the selected deployment
    api_url = selected_deployment['api_url']
    usage_plan_id = selected_deployment['usage_plan_id']
    users_table_name = selected_deployment['users_table_name']
        
    print(f"\n✅ Using deployment '{selected_deployment['api_name']}'")
    print("----------------------------------------------\n")
    
    # 2. Get user information from the administrator
    display_name = input("Enter the new user's display name (e.g., Jane Doe): ").strip()
    if not display_name:
        print("❌ Display name cannot be empty.")
        exit(1)

    # 3. Generate a unique user ID from the display name
    # Example: "Jane Doe" -> "jane.doe"
    user_id = re.sub(r'\s+', '.', display_name.lower())
    
    # Append a short unique hash to prevent collisions with common names
    unique_hash = uuid.uuid4().hex[:4]
    user_id = f"{user_id}.{unique_hash}"

    print(f"  - Generated unique User ID: {user_id}")
    
    try:
        # 4. Create the API Key
        print("\n⚙️  Creating new API Key...")
        key_name = f"user-{user_id}-key"
        key_response = apigateway_client.create_api_key(
            name=key_name,
            description=f"API Key for {display_name}",
            enabled=True,
        )
        api_key_value = key_response['value']
        api_key_id = key_response['id']
        print(f"  ✅ API Key '{key_name}' created.")

        # 5. Associate the key with the Usage Plan
        print("⚙️  Associating Key with Usage Plan...")
        apigateway_client.create_usage_plan_key(
            usagePlanId=usage_plan_id,
            keyId=api_key_id,
            keyType='API_KEY'
        )
        print("  ✅ Key associated with plan.")

        # 6. Add the user record to DynamoDB
        print("⚙️  Adding user record to DynamoDB...")
        dynamodb_client.put_item(
            TableName=users_table_name,
            Item={
                'apiKeyId': {'S': api_key_id},
                'userId': {'S': user_id},
                'displayName': {'S': display_name}
            }
        )
        print("  ✅ User record created.")

        # 7. Output the credentials for the new user
        print("\n\n" + "="*50)
        print("🎉 SUCCESS! User has been created. 🎉")
        print("="*50)
        print("\nPlease provide the following credentials to the new user. ")
        print("The API Key is secret and will not be shown again.\n")
        print(f"  ➡️   API URL: {api_url}")
        print(f"  🔑   API Key: {api_key_value}\n")

    except Exception as e:
        print("\n" + "="*50)
        print("🔥 AN ERROR OCCURRED 🔥")
        print(f"Error details: {e}")
        print("Please check the error messages. You may need to clean up partial resources from the AWS console.")
        print("="*50)


