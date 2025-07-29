const express = require('express');
const router = express.Router();
const { completeOnboarding, getOnboardingStatus } = require('../controllers/onboardingController');

// Complete onboarding
router.post('/', completeOnboarding);

// Get onboarding status
router.get('/:userId', getOnboardingStatus);

module.exports = router; 