export const registerSchema = {
  body: {
    type: 'object',
    required: ['firstName', 'lastName', 'email', 'password'],
    properties: {
      firstName: { type: 'string', minLength: 2, maxLength: 50 },
      lastName: { type: 'string', minLength: 2, maxLength: 50 },
      email: { type: 'string', format: 'email' },
      password: { 
        type: 'string', 
        minLength: 8,
        pattern: '^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d).+$' 
      },
      phoneNumber: { type: 'string' },
      company: { type: 'string', maxLength: 100 }
    }
  }
};

export const loginSchema = {
  body: {
    type: 'object',
    required: ['email', 'password'],
    properties: {
      email: { type: 'string', format: 'email' },
      password: { type: 'string', minLength: 1 }
    }
  }
};

export const updateProfileSchema = {
  body: {
    type: 'object',
    properties: {
      firstName: { type: 'string', minLength: 2, maxLength: 50 },
      lastName: { type: 'string', minLength: 2, maxLength: 50 },
      phoneNumber: { type: 'string' },
      company: { type: 'string', maxLength: 100 }
    }
  }
};

export const changePasswordSchema = {
  body: {
    type: 'object',
    required: ['currentPassword', 'newPassword'],
    properties: {
      currentPassword: { type: 'string', minLength: 1 },
      newPassword: { 
        type: 'string', 
        minLength: 8,
        pattern: '^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d).+$' 
      }
    }
  }
};
