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
    /** Not used by the welcome screen itself — the sign-in and verify screens
     *  share it as their brand eyebrow. */
    eyebrow: 'Shared event camera',
    joinEvent: 'Join Event',
    signUp: 'Not yet a member? Sign up',
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
    nameLabel: 'Cover title',
    namePlaceholder: "What's the occasion?",
    nameRequired: 'Give your event a name so guests know where they have landed',

    // Step 2
    closingHeading: 'When does your event end?',
    closingSupporting:
      'Guests can start snapping as soon as you share the QR code, and keep going until then.',
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
    cameraRollToggle: 'Allow adding from camera roll',
    cameraRollToggleDescription: 'As well as taking photos in the app.',
    cameraRollAnytime: 'Any time',
    cameraRollAnytimeDescription: 'Guests can add camera-roll photos whenever they like.',
    cameraRollAfterClose: 'Only after the event ends',
    cameraRollAfterCloseDescription: 'Guests shoot live during the event, and add extras once it closes.',

    // Step 7 — kept for post-publish editing, where the finer-grained
    // own-photos-only option still applies. The creation flow itself now only
    // offers the two-state toggle below.
    privacyAllGuests: 'Everyone can see all revealed photos',
    privacyOwnOnly: 'Guests see only their own photos',
    privacyHostsOnly: 'Only you, until you share them',
    guestDownloads: 'Let guests download photos',

    // Step 7/8, merged: when photos appear, and who they appear for. Framed
    // entirely around the guest experience — the host isn't waiting on this
    // the way a guest is, so the copy never implies otherwise.
    revealHeading: 'When should photos appear in the gallery?',
    revealSupporting:
      "This is for guests only. You'll be able to see the photos immediately as they come through.",
    guestsCanViewGallery: 'Guests can view the gallery',
    guestsCanViewGalleryDescription:
      'Including photos taken by other guests.',
    revealDuring: 'During the event',
    revealDuringDescription: 'Photos appear as guests take them.',
    revealAtClose: 'When the event closes',
    revealAtCloseDescription: 'Everything appears the moment your event ends.',
    revealCustom: 'A custom day and time',
    revealCustomDescription: '',
    revealDeveloping: 'Developing',
    revealReturnAt: 'Come back at {time}',
    revealEditableNote: 'You can change any of this later, once your event is live.',

    // Step 9
    treatmentHeading: 'How should the photos look?',
    treatmentSupporting: 'You can change or remove this later. Your originals are always kept.',
    treatmentOriginal: 'Original',
    treatmentDisposable: 'Disposable',
    treatmentBlackAndWhite: 'Black and white',
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
