# Local Setup Guide for CallSync Central

This guide provides step-by-step instructions for setting up and running the CallSync Central application on your local machine for development and testing.

## Prerequisites

Before you begin, ensure you have the following installed:

*   **Node.js**: Version 20.x or later.
*   **npm**: Comes bundled with Node.js.

You will also need access to a running **Asterisk PBX** instance with AMI (Asterisk Manager Interface) and ARI (Asterisk REST Interface) enabled, as well as a **MySQL database** for Call Detail Records (CDR).

## 1. Installation

Clone the project repository to your local machine and navigate into the project directory. Then, install the required dependencies using npm:

```bash
npm install
```

This command will download and install all the packages listed in the `package.json` file.

## 2. Configuration (Important!)

This application uses a unique approach for configuration that simplifies local setup. Instead of using environment variables (`.env` file), all connection settings are managed through a JSON file that is editable via the application's Admin Panel.

**File:** `data/config.json`

This file stores the connection details for:
*   **ARI (Asterisk REST Interface)**
*   **AMI (Asterisk Manager Interface)**
*   **CDR (Call Detail Records) Database**

**Steps to Configure:**

1.  **Start the application** (see the next step). The application will start with default or existing settings from `data/config.json`.
2.  **Open the Admin Panel:** Navigate to `http://localhost:9002/admin` in your browser.
3.  **Update and Test Connections:** On the "Настройки системы" (System Settings) tab, you will see input fields for ARI, AMI, and CDR connections.
    *   Enter the correct `host`, `port`, `username`, and `password` for your local or remote Asterisk and MySQL instances.
    *   Use the "Тест" (Test) buttons for each service to verify that the application can connect successfully.
4.  **Save the Configuration:** Once all connections are tested and working, click the "Сохранить изменения" (Save Changes) button. This will update the `data/config.json` file with your settings.

**Note on `.env` file:** The project includes an empty `.env` file. For this application's current setup, **you do not need to add any variables to it.** All configuration is handled through the Admin Panel.

## 3. Running the Application

To start the development server, run the following command:

```bash
npm run dev
```

This will start the Next.js application in development mode with Turbopack for faster performance.

## 4. Accessing the Application

Once the server is running, you can access the application by opening your web browser and navigating to:

**http://localhost:9002**

You can now log in using the credentials of users stored in `data/users.json`. By default, you can try:

*   **Email:** `admin@mail.ru`, **Password:** `405384` (Admin Role)
*   **Email:** `operator@mail.ru`, **Password:** `40538411` (Operator Role)

Enjoy testing CallSync Central!
