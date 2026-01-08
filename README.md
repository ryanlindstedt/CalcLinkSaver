# CalcLinkSaver

CalcLinkSaver is a powerful tool to save, manage, and download your AWS Calculator estimates. It operates in two modes: a simple **local-only mode** that stores data in your browser, and a powerful **AWS backend mode** for multi-user collaboration and persistent, centralized storage.

The system consists of a user-friendly Tampermonkey/Greasemonkey script that seamlessly integrates with the AWS Calculator interface, which can optionally connect to a self-hosted, serverless backend on AWS.

## Features

- **Save and Manage Estimates:** Save your AWS Calculator estimates with a single click and manage them in a clean, intuitive interface.
- **Two Operating Modes:**
    -   **Local-Only:** Works out-of-the-box with no configuration. Data is stored directly in your browser's secure storage. Perfect for single-user use.
    -   **AWS Backend:** Enables multi-user collaboration with centralized data storage and secure API key authentication.
- **Rich User Interface:** A modern, responsive UI that mimics the AWS console's look and feel.
- **Data Export:** Export your saved estimates to CSV for further analysis or record-keeping.
- **Shortcut Downloads:** Download estimates as `.url` files for easy access from your desktop.
- **Easy Backend Deployment:** A single script to deploy the entire optional AWS backend infrastructure.
- **Simple User Management:** A command-line utility to add new users to the AWS backend.

## How It Works

The CalcLinkSaver system is composed of two main components:

1.  **The User Script (`CalcLinkSaver.user.js`):** This script is installed in your browser via a user script manager like Tampermonkey. It runs on the AWS Calculator website, adding the "CalcLinkSaver" button and management modal. It intercepts the "copy" action of a saved estimate and saves the details. Where it saves depends on the configuration: either to the browser's local storage or to the AWS backend.

2.  **The AWS Backend (Optional):** The backend is a serverless application you can deploy to your own AWS account. It consists of:
    -   **Amazon API Gateway:** Provides a RESTful API for the user script to communicate with the backend. It handles request routing, authentication, and throttling.
    -   **AWS Lambda:** A single Python function that contains all the business logic for creating, retrieving, and deleting estimates.
    -   **Amazon DynamoDB:** Two DynamoDB tables are used for data storage: one for estimates and another to map user API keys to user information.

## Architecture Diagram (AWS Mode)

```
+------------------+      +---------------------+      +-----------------+
|   User's Browser |      |  AWS API Gateway    |      |   AWS Lambda    |
| (Tampermonkey)   |----->| (REST API)          |----->| (Python)        |
+------------------+      +---------------------+      +-----------------+
        |                                                   |
        |                                                   v
        |                                     +--------------------------+
        +------------------------------------->|     Amazon DynamoDB      |
                                              | (Estimates & Users Tables)|
                                              +--------------------------+
```

## Installation and Usage

There are two ways to use CalcLinkSaver:

### Mode 1: Local-Only (Single User, No Setup)

This is the simplest way to get started. All data will be stored in your browser.

1.  **Install a User Script Manager:** If you don't already have one, install [Tampermonkey](https://www.tampermonkey.net/) or another user script manager for your browser.
2.  **Install the Script:** Open the `CalcLinkSaver-2025.9.18_001.user.js` file in your browser. Your script manager will ask you to install it. Click "Install".
3.  **Done!** Navigate to the [AWS Calculator](https://calculator.aws/), and you will see the "CalcLinkSaver" button. No further configuration is needed.

### Mode 2: AWS Backend (Multi-User, Self-Hosted)

This mode requires you to deploy the backend to your own AWS account. This is ideal for teams or for individuals who want their data synchronized across multiple browsers/computers.

**Step 1: Deploy the AWS Backend**

First, deploy the serverless application.

**Prerequisites:**

-   An AWS account.
-   The AWS CLI installed and configured with your credentials.
-   Python 3.6+ and `pip` installed.
-   The `boto3` library: `pip install boto3`.

**Deployment:**

1.  **Clone the Repository:**
    ```bash
    git clone https://github.com/your-username/CalcLinkSaver.git
    cd CalcLinkSaver
    ```

2.  **Run the Deployment Script:**
    ```bash
    python deploy_backend_multiuser.py
    ```
    The script creates all necessary AWS resources.

3.  **Save the API URL:** Once complete, the script will output the **API URL**. Keep this URL safe; you will need it to configure the user script and add users.

**Step 2: Add Users to the Backend**

A utility script is provided to add users. Each user gets their own API Key.

1.  **Run the `add_user.py` script:**
    ```bash
    python add_user.py
    ```

2.  **Follow the Prompts:** The script will ask for the user's display name and will then generate a unique user ID and a secret **API Key**.

3.  **Share the Credentials:** Provide the new user with their generated **API Key** and the **API URL** from the deployment step.

**Step 3: Install and Configure the User Script**

Finally, each user must install and configure the user script.

1.  **Install a User Script Manager:** Install [Tampermonkey](https://www.tampermonkey.net/).
2.  **Install the Script:** Open the `CalcLinkSaver-2025.9.18_001.user.js` file and your user script manager will prompt you to install it.
3.  **Configure for AWS Mode:**
    -   Navigate to the [AWS Calculator](https://calculator.aws/).
    -   Click the Tampermonkey icon in your browser's toolbar and select "Configure CalcLinkSaver Backend".
    -   Enter the **API Gateway URL** from the deployment.
    -   Enter the **API Key** that was generated for you.

The script is now configured for AWS mode. The footer of the modal will show "Mode: AWS Backend (Multi-User)".

## License

This project is licensed under the GNU GPL v3 license. See the [LICENSE](LICENSE) file for details.
