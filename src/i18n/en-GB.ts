/**
 * British English copy deck.
 *
 * Every user-visible string lives here rather than inline in a screen. Three
 * reasons, in order of how soon they bite:
 *
 * 1. Copy gets rewritten far more often than layout, and a writer should not
 *    have to open a component to change a sentence.
 * 2. Adding Hindi, Urdu, Punjabi, Bengali, Gujarati, Arabic or French later
 *    becomes a new file rather than an audit of every screen.
 * 3. It makes the brand-neutrality rule enforceable — the product name reaches
 *    copy only through `BRAND_CONFIG` interpolation, never as a literal.
 *
 * British spelling and British date order throughout.
 */

export const enGB = {
  common: {
    next: 'Next',
    back: 'Back',
    save: 'Save',
    cancel: 'Cancel',
    done: 'Done',
    edit: 'Edit',
    retry: 'Try again',
    loading: 'Loading',
    somethingWentWrong: 'Something went wrong',
    offline: 'You are offline',
    offlineDetail: 'Your work is saved. It will sync when you are back online.',
  },

  welcome: {
    eyebrow: 'Shared event camera',
    statement: 'The night, from every side.',
    supporting: 'Guests scan a code and start shooting. No app, no account. You keep every photo.',
    createEvent: 'Create an event',
    signIn: 'I already have an account',
  },

  auth: {
    title: 'Sign in',
    emailLabel: 'Email address',
    emailPlaceholder: 'you@example.com',
    sendCode: 'Send me a code',
    codeLabel: 'Six-digit code',
    codeSentTo: 'We sent a code to {email}',
    verify: 'Verify',
    resend: 'Send another code',
    resendIn: 'You can request another code in {seconds}s',
    invalidEmail: 'Enter an email address so we can send your code',
    invalidCode: 'That code is not right. Check it and try again.',
    expiredCode: 'That code has expired. Request a new one.',
  },

  create: {
    // Step 1
    nameHeading: 'What should we call your event?',
    nameSupporting: 'This is the name your guests will see when they join.',
    nameLabel: 'Event name',
    namePlaceholder: 'Priya & Arjun',
    nameRequired: 'Give your event a name so guests know where they have landed',

    // Step 2
    closingHeading: 'When should this event close?',
    closingSupporting:
      'Guests can join as soon as you share it. Choose the last date and time they can capture photos.',
    closingDateLabel: 'Closing date',
    closingTimeLabel: 'Closing time',
    timezoneLabel: 'Time zone',
    closingInPast: 'Choose a closing time in the future',

    // Step 3
    coverHeading: 'Make it feel like your event.',
    coverSupporting: 'This is the first thing your guests see.',
    choosePhoto: 'Choose a photo',
    takePhoto: 'Take a photo',
    removePhoto: 'Remove photo',
    previewCover: 'Cover',
    previewCamera: 'Camera',
    previewGallery: 'Gallery',

    // Step 4
    photoLimitHeading: 'How many photos can each guest take?',
    photoLimitSupporting:
      'A limit makes people think before they shoot. It tends to produce better photos, not fewer.',
    photoLimitUnlimited: 'Unlimited',
    photoLimitCount: '{count} photos',

    // Step 5 — deliberately not called "loosen restrictions"
    olderPhotosHeading: 'Allow older photos',
    olderPhotosSupporting: 'Guests can upload relevant photos taken before the event.',
    cameraRollAfterClose: 'Allow uploads after the event closes',
    cameraRollLimit: 'Camera-roll uploads per guest',

    // Step 6
    formatsHeading: 'How can guests contribute?',
    formatsSupporting: 'Photos are included with every event.',
    formatPhoto: 'Photos',
    formatVideo: 'Short video',
    formatAudio: 'Audio Guestbook',
    formatMessages: 'Written messages',
    formatMemoryBook: 'Memory Book',
    comingLater: 'Coming later',

    // Step 7
    privacyHeading: 'Who can see the photos?',
    privacyAllGuests: 'Everyone can see all revealed photos',
    privacyOwnOnly: 'Guests see only their own photos',
    privacyHostsOnly: 'Only you, until you share them',
    pinRequired: 'Require a PIN to join',
    guestDownloads: 'Let guests download photos',
    hostApproval: 'Approve photos before they appear',

    // Step 8
    revealHeading: 'When should the photos appear?',
    revealDuring: 'During the event',
    revealAtClose: 'When the event closes',
    reveal12h: '12 hours after',
    reveal24h: '24 hours after',
    revealCustom: 'At a time I choose',
    revealManual: 'When I decide',
    revealDeveloping: 'Developing',
    revealReturnAt: 'Come back at {time}',

    // Step 9
    treatmentHeading: 'How should the photos look?',
    treatmentSupporting: 'You can change or remove this later. Your originals are always kept.',
    treatmentOriginal: 'Original',
    treatmentDisposable: 'Disposable',
    treatmentBlackAndWhite: 'Black and white',
    treatmentWarmFilm: 'Warm film',
    dateStamp: 'Add a date stamp',

    // Step 10
    packageHeading: 'Choose your package',
    packagePerEvent: 'per event',
    packageIncluded: 'Included',
    packageSelect: 'Choose {name}',
    packageSelected: 'Selected',

    // Step 11
    qrHeading: 'Choose your QR design',
    qrSupporting: 'You can print it, share it, or put it on a screen.',

    // Step 12
    reviewHeading: 'Ready to go?',
    reviewSupporting: 'Check everything over. You can change any of it later.',
    previewAsGuest: 'Preview as a guest',
    publish: 'Create my event',

    // Step 13
    successHeading: 'Your event is live.',
    successSupporting: 'Share the code and your guests can start shooting.',
    shareLink: 'Share link',
    saveQr: 'Save QR code',
    openDashboard: 'Open dashboard',
    // Interpolated with the event name and guest link. No brand name literal.
    shareMessage: 'Join the shared camera for {eventName} — every photo in one place: {link}',
  },

  home: {
    emptyStatement: 'Every celebration deserves more than one point of view.',
    createFirst: 'Create an event',
    yourEvents: 'Your events',
    draft: 'Draft',
    live: 'Live',
    closed: 'Closed',
    revealed: 'Revealed',
  },

  dashboard: {
    shareQr: 'Share QR',
    previewGuestView: 'Preview guest view',
    editEvent: 'Edit event',
    visits: 'Visits',
    contributors: 'Contributors',
    photos: 'Photos',
    functions: 'Functions',
    addFunction: 'Add a function',
    addFunctionComingLater: 'Multiple functions are coming later',
    archive: 'Archive event',
  },

  errors: {
    // Safe to show a guest or host. Never contains a token, signed URL or path.
    uploadFailed: 'That photo did not upload',
    uploadFailedDetail: 'It is saved on your phone and we will try again.',
    eventClosed: 'This event has closed',
    eventClosedDetail: 'You can no longer add photos.',
    limitReached: 'You have used all your photos',
    linkInvalid: 'This link is not valid',
    linkExpired: 'This link has expired',
    permissionDenied: 'You do not have access to this event',
  },
} as const;

export type CopyDeck = typeof enGB;
