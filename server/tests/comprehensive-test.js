import axios from 'axios';

const API_URL = 'http://localhost:5000/api';

// Test colors for console output
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    cyan: '\x1b[36m',
};

let testResults = {
    passed: 0,
    failed: 0,
    errors: []
};

// Helper function for test logging
const log = (message, color = colors.reset) => {
    console.log(`${color}${message}${colors.reset}`);
};

const testResult = (testName, success, error = null) => {
    if (success) {
        log(`✓ ${testName}`, colors.green);
        testResults.passed++;
    } else {
        log(`✗ ${testName}`, colors.red);
        testResults.failed++;
        if (error) {
            testResults.errors.push({ testName, error: error.message || error });
        }
    }
};

// Test variables
let testUser = {
    email: `test${Date.now()}@example.com`,
    password: 'TestPassword123',
    username: `testuser${Date.now()}`,
    phoneNumber: `+1${Date.now().toString().slice(-10)}` // Unique phone number
};

let authTokens = {};
let chatId = null;
let messageId = null;

// Main test execution
async function runTests() {
    log('\n=== Chat Application API Test Suite ===\n', colors.cyan);

    // Authentication Tests
    log('Testing Authentication Endpoints...', colors.yellow);
    await testRegistration();
    await testLogin();
    await testGetMe();

    // User Tests
    log('\nTesting User Endpoints...', colors.yellow);
    await testGetProfile();
    await testUpdateProfile();

    // Chat Tests
    log('\nTesting Chat Endpoints...', colors.yellow);
    await testGetChats();
    await testCreatePrivateChat();

    // Message Tests
    log('\nTesting Message Endpoints...', colors.yellow);
    await testSendMessage();
    await testGetMessages();

    // Security Tests
    log('\nTesting Security Features...', colors.yellow);
    await testAuthenticationValidation();
    await testInputValidation();

    // Final Results
    log('\n=== Test Results ===\n', colors.cyan);
    log(`Passed: ${testResults.passed}`, colors.green);
    log(`Failed: ${testResults.failed}`, colors.red);

    if (testResults.errors.length > 0) {
        log('\nErrors:', colors.red);
        testResults.errors.forEach(err => {
            log(`  - ${err.testName}: ${err.error}`, colors.red);
        });
    }

    process.exit(testResults.failed > 0 ? 1 : 0);
}

// Test: User Registration
async function testRegistration() {
    try {
        const response = await axios.post(`${API_URL}/auth/register`, testUser);
        testResult('Registration', response.status === 201 && response.data.success);
        authTokens = response.data.tokens;
    } catch (error) {
        testResult('Registration', false, error);
    }
}

// Test: User Login
async function testLogin() {
    try {
        const response = await axios.post(`${API_URL}/auth/login`, {
            email: testUser.email,
            password: testUser.password
        });
        testResult('Login', response.status === 200 && response.data.success);
        authTokens = response.data.tokens;
    } catch (error) {
        testResult('Login', false, error);
    }
}

// Test: Get Current User
async function testGetMe() {
    try {
        const response = await axios.get(`${API_URL}/auth/me`, {
            headers: { Authorization: `Bearer ${authTokens.accessToken}` }
        });
        testResult('Get Current User', response.status === 200 && response.data.success);
    } catch (error) {
        testResult('Get Current User', false, error);
    }
}

// Test: Get User Profile
async function testGetProfile() {
    try {
        const response = await axios.get(`${API_URL}/users/profile`, {
            headers: { Authorization: `Bearer ${authTokens.accessToken}` }
        });
        testResult('Get Profile', response.status === 200 && response.data.success);
    } catch (error) {
        testResult('Get Profile', false, error);
    }
}

// Test: Update User Profile
async function testUpdateProfile() {
    try {
        const response = await axios.put(`${API_URL}/users/profile`, {
            username: `updateduser${Date.now()}`,
            bio: 'Test bio'
        }, {
            headers: { Authorization: `Bearer ${authTokens.accessToken}` }
        });
        testResult('Update Profile', response.status === 200 && response.data.success);
    } catch (error) {
        testResult('Update Profile', false, error);
    }
}

// Test: Get All Chats
async function testGetChats() {
    try {
        const response = await axios.get(`${API_URL}/chats`, {
            headers: { Authorization: `Bearer ${authTokens.accessToken}` }
        });
        testResult('Get Chats', response.status === 200 && response.data.success);
    } catch (error) {
        testResult('Get Chats', false, error);
    }
}

// Test: Create Private Chat (will need another user from registration)
async function testCreatePrivateChat() {
    try {
        // First create a second user
        const secondUser = {
            email: `test2${Date.now()}@example.com`,
            password: 'TestPassword123',
            username: `testuser2${Date.now()}`,
            phoneNumber: `+2${Date.now().toString().slice(-9)}` // Unique phone number
        };

        console.log('Registering second user:', secondUser);
        const regResponse = await axios.post(`${API_URL}/auth/register`, secondUser);
        console.log('Second user registration response:', regResponse.data);
        const secondUserId = regResponse.data.user.id;
        console.log('Second user ID:', secondUserId);

        // Now create a private chat with the second user
        console.log('Creating private chat with user ID:', secondUserId);
        const response = await axios.post(`${API_URL}/chats/private/${secondUserId}`, {}, {
            headers: { Authorization: `Bearer ${authTokens.accessToken}` }
        });
        console.log('Private chat creation response:', response.data);
        testResult('Create Private Chat', response.status === 200 && response.data.success);
        chatId = response.data.chat._id;
    } catch (error) {
        console.log('Error in testCreatePrivateChat:', error.response?.data || error.message);
        testResult('Create Private Chat', false, error);
    }
}

// Test: Send Message
async function testSendMessage() {
    if (!chatId) {
        testResult('Send Message', false, { message: 'No chat ID available' });
        return;
    }

    try {
        const response = await axios.post(`${API_URL}/messages/${chatId}/text`, {
            text: 'Test message'
        }, {
            headers: { Authorization: `Bearer ${authTokens.accessToken}` }
        });
        testResult('Send Message', response.status === 200 && response.data.success);
        messageId = response.data.message?._id;
    } catch (error) {
        testResult('Send Message', false, error);
    }
}

// Test: Get Messages
async function testGetMessages() {
    if (!chatId) {
        testResult('Get Messages', false, { message: 'No chat ID available' });
        return;
    }

    try {
        const response = await axios.get(`${API_URL}/messages/${chatId}`, {
            headers: { Authorization: `Bearer ${authTokens.accessToken}` }
        });
        testResult('Get Messages', response.status === 200 && response.data.success);
    } catch (error) {
        testResult('Get Messages', false, error);
    }
}

// Test: Authentication Validation
async function testAuthenticationValidation() {
    try {
        // Try to access protected route without token
        try {
            await axios.get(`${API_URL}/users/profile`);
            testResult('Authentication Required', false, { message: 'Request should have failed' });
        } catch (error) {
            testResult('Authentication Required', error.response?.status === 401);
        }
    } catch (error) {
        testResult('Authentication Validation', false, error);
    }
}

// Test: Input Validation
async function testInputValidation() {
    try {
        // Test invalid email
        try {
            await axios.post(`${API_URL}/auth/register`, {
                email: 'invalid-email',
                password: 'TestPassword123',
                username: 'testuser',
                phoneNumber: '+12025551234'
            });
            testResult('Email Validation', false, { message: 'Invalid email should be rejected' });
        } catch (error) {
            testResult('Email Validation', error.response?.status === 400);
        }

        // Test weak password
        try {
            await axios.post(`${API_URL}/auth/register`, {
                email: `test${Date.now()}@example.com`,
                password: 'weak',
                username: 'testuser',
                phoneNumber: '+12025551234'
            });
            testResult('Password Validation', false, { message: 'Weak password should be rejected' });
        } catch (error) {
            testResult('Password Validation', error.response?.status === 400);
        }
    } catch (error) {
        testResult('Input Validation', false, error);
    }
}

// Run all tests
runTests().catch(error => {
    log(`Fatal error: ${error.message}`, colors.red);
    process.exit(1);
});
