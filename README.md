# **Overview**

CalcLinkSaver is a tool designed to save, manage, and download AWS Calculator estimates through a secure, multi-user AWS backend or via local browser storage. It integrates directly with the [AWS Calculator](https://calculator.aws/) interface to intercept estimate URLs and store them for later use.

The tool operates in two modes:

- **Local-Only Mode**: Data is stored directly in the browser's storage, suitable for single-user use with no configuration required.
- **AWS Backend Mode**: Enables persistent, centralized storage and multi-user collaboration using a self-hosted serverless backend.
    

# **Architecture and Design**

The system consists of a frontend user script and an optional backend infrastructure:
- **Frontend (`CalcLinkSaver.user.js`)**: A Tampermonkey/Greasemonkey script that provides the user interface and logic for saving estimates directly from the AWS Calculator page.
- **Backend (Optional)**: A serverless AWS infrastructure composed of:
    - **Amazon API Gateway**: Acts as a RESTful API to route requests between the frontend and the backend logic.
    - **AWS Lambda**: A Python-based function (`lambda_function.py`) that handles the business logic for creating, retrieving, and deleting estimates.
    - **Amazon DynamoDB**: Utilizes two tables—one for storing estimate data and another for mapping API keys to user identities for secure multi-user access.

```
          +------------------+      +-------------------+      +--------------+
          |  User's Browser  |----->|  AWS API Gateway  |----->|  AWS Lambda  |
          |  (Tampermonkey)  |      |    (REST API)     |      |   (Python)   |
          +------------------+      +-------------------+      +--------------+
                   |                                                  |
                   |                                                  v
                   |                            +-----------------------------+
                   +--------------------------->|       Amazon DynamoDB       |
                                                |  (Estimates & Users Table)  |
                                                +-----------------------------+
```


# **Client Installation**

1. Install a user script manager such as [Tampermonkey](https://www.tampermonkey.net/) in your browser. 
2. Install the `CalcLinkSaver.user.js` script by going to:
   [https://github.com/ryanlindstedt/CalcLinkSaver/raw/refs/heads/master/CalcLinkSaver.user.js](https://github.com/ryanlindstedt/CalcLinkSaver/raw/refs/heads/master/CalcLinkSaver.user.js)
4. The tool will be active immediately upon visiting to the [AWS Calculator](https://calculator.aws/).
5. For local only mode install is done, for AWS Backend, continue to AWS Backend Install.

**NOTE:** Some browsers will need additional security permissions. See [Tampermonkey FAQ for Chrome based (including Edge)](https://www.tampermonkey.net/faq.php#Q209).


# **AWS Backend Installation (Optional)**

There are a couple of scripts will will deploy the backend in AWS and also create users:
- **`deploy_backend_multiuser.py`**: Automatically creates the IAM roles, DynamoDB tables for estimates and users, the Lambda function, and the API Gateway. It will output an **API URL** at the end which is the URL all users will use.
- **`add_user.py`**: Prompts you for a display name and generates a unique **API Key** associated with that URL.
## **Step 1: Download and Run the Scripts**

Copy and paste the following commands into the CloudShell terminal to download the required scripts and deploy the infrastructure:

```
# 1. Download the deployment scripts
curl -O https://raw.githubusercontent.com/ryanlindstedt/CalcLinkSaver/refs/heads/master/deploy_backend_multiuser.py
curl -O https://raw.githubusercontent.com/ryanlindstedt/CalcLinkSaver/refs/heads/master/add_user.py
```
```
# 2. Run the deployment (this creates the API, Lambda, and DynamoDB tables)
python3 deploy_backend_multiuser.py
```
```
# 3. Create your first user to get your API Key and URL
python3 add_user.py
```

## **Step 2: Configure Client**
Once the scripts finish, take the **API URL** and the **API Key** provided by the terminal and enter them into the "Configure CalcLinkSaver Backend" menu in your browser's Tampermonkey script.

## **Uninstalling**

Because the deployment script creates several discrete resources, they must be removed via the AWS Management Console or CLI:

- **API Gateway**: Delete the `CalcLinkSaverMultiUserAPI-UNIQUE_SUFFIX`.
- **Lambda**: Delete the `CalcLinkSaverMultiUserFunction-UNIQUE_SUFFIX`.
- **DynamoDB**: Delete the `Estimates-UNIQUE_SUFFIX` and `Users-UNIQUE_SUFFIX` tables associated with the project.
- **IAM**: Delete the `CalcLinkSaverLambdaRole-UNIQUE_SUFFIX` and associated policies.

