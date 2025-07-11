'use client';

import AlertUtils from './AlertUtils';

// Sistemske poruke koje se koriste nakon različitih operacija
const SystemMessages = {
  // Auth related messages
  auth: {
    loginSuccess: () => 
      AlertUtils.success('Welcome', 'You have successfully logged in'),
    
    logoutSuccess: () => 
      AlertUtils.info('Logged Out', 'You have been successfully logged out'),
    
    registrationSuccess: () => 
      AlertUtils.success('Registration Successful', 'Your account has been created successfully'),
    
    passwordResetEmailSent: () => 
      AlertUtils.info('Email Sent', 'Password reset instructions have been sent to your email')
  },
  
  // Proposal related messages
  proposal: {
    createSuccess: () => 
      AlertUtils.success('Proposal Created', 'Your proposal has been successfully created'),
    
    updateSuccess: () => 
      AlertUtils.success('Proposal Updated', 'Your proposal has been successfully updated'),
    
    deleteSuccess: () => 
      AlertUtils.success('Proposal Deleted', 'Your proposal has been successfully deleted'),
    
    publishSuccess: () => 
      AlertUtils.success('Proposal Published', 'Your proposal has been successfully published')
  },
  
  // Response related messages
  response: {
    submitSuccess: () => 
      AlertUtils.success('Response Submitted', 'Your response has been successfully submitted'),
    
    saveSuccess: () => 
      AlertUtils.success('Response Saved', 'Your response has been saved as draft'),
    
    updateSuccess: () => 
      AlertUtils.success('Response Updated', 'Your response has been successfully updated')
  },
  
  // General system messages
  system: {
    operationSuccess: (message: string = 'Operation completed successfully') => 
      AlertUtils.success('Success', message),
    
    operationFailed: (message: string = 'Operation failed. Please try again') => 
      AlertUtils.error('Error', message),
    
    saveSuccess: (itemName: string = 'Item') => 
      AlertUtils.success('Saved', `${itemName} has been saved successfully`),
    
    deleteSuccess: (itemName: string = 'Item') => 
      AlertUtils.success('Deleted', `${itemName} has been deleted successfully`),
    
    updateSuccess: (itemName: string = 'Item') => 
      AlertUtils.success('Updated', `${itemName} has been updated successfully`),
    
    createSuccess: (itemName: string = 'Item') => 
      AlertUtils.success('Created', `${itemName} has been created successfully`)
  }
};

export default SystemMessages; 