
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
    """Fetches user details from the UsersTable based on the API Key ID."""
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
