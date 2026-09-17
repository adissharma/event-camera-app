const fs = require('node:fs');
const path = require('node:path');
const {
  PBXBuildFile,
  PBXCopyFilesBuildPhase,
  PBXFileReference,
  PBXFileSystemSynchronizedBuildFileExceptionSet,
  PBXFileSystemSynchronizedRootGroup,
  PBXNativeTarget,
} = require('@bacons/xcode');
const { createConfigurationListForType } = require('@bacons/apple-targets/build/configuration-list');
const { withDangerousMod } = require('expo/config-plugins');
const { withXcodeProjectBeta } = require('@bacons/apple-targets/build/with-bacons-xcode');

const CLIP_PRODUCT_TYPE = 'com.apple.product-type.application.on-demand-install-capable';
const WIDGET_PRODUCT_TYPE = 'com.apple.product-type.app-extension';
const TARGET_NAME = 'EventLiveActivityClipExtension';
const ENTITLEMENTS_PATH = '.targets/clip-liveactivity/generated.entitlements';
const LIVE_ACTIVITY_DIRECTORY = 'live-activity';

/**
 * A WidgetKit extension that belongs to the App Clip, not the full app.
 *
 * `@bacons/apple-targets` correctly generates the full-app widget but always
 * embeds widgets into the main application. Apple's App Clip architecture
 * needs a second WidgetKit extension nested inside the Clip. This plugin owns
 * that target explicitly while reusing the full widget's exact Swift sources,
 * fonts and assets through its synchronised source group.
 */
function withClipLiveActivity(config) {
  config = withDangerousMod(config, [
    'ios',
    async (cfg) => {
      const output = path.join(cfg.modRequest.platformProjectRoot, ENTITLEMENTS_PATH);
      fs.mkdirSync(path.dirname(output), { recursive: true });
      fs.writeFileSync(
        output,
        `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0"><dict><key>com.apple.developer.on-demand-install-capable</key><true/></dict></plist>\n`,
      );
      return cfg;
    },
  ]);

  return withXcodeProjectBeta(config, (cfg) => {
    const project = cfg.modResults;
    const targets = project.rootObject.props.targets;
    const clipTarget = targets.find(
      (target) => PBXNativeTarget.is(target) && target.props.productType === CLIP_PRODUCT_TYPE,
    );
    const fullWidget = targets.find(
      (target) => PBXNativeTarget.is(target) && target.props.name === 'liveactivity',
    );

    if (!clipTarget || !fullWidget) {
      throw new Error(
        '[with-clip-live-activity] Expected both the App Clip and full-app Live Activity targets. ' +
          'Ensure @bacons/apple-targets runs before this plugin.',
      );
    }

    const clipBundleId = String(
      clipTarget.getDefaultBuildSetting('PRODUCT_BUNDLE_IDENTIFIER') ?? '',
    );
    if (!clipBundleId) {
      throw new Error('[with-clip-live-activity] App Clip is missing PRODUCT_BUNDLE_IDENTIFIER.');
    }
    const teamId = String(
      cfg.ios?.appleTeamId ?? clipTarget.getDefaultBuildSetting('DEVELOPMENT_TEAM') ?? '',
    );

    let target = targets.find(
      (candidate) => PBXNativeTarget.is(candidate) && candidate.props.name === TARGET_NAME,
    );

    if (!target) {
      const productRef = PBXFileReference.create(project, {
        explicitFileType: 'wrapper.app-extension',
        includeInIndex: 0,
        path: `${TARGET_NAME}.appex`,
        sourceTree: 'BUILT_PRODUCTS_DIR',
      });
      project.rootObject.ensureProductGroup().props.children.push(productRef);
      const buildFile = PBXBuildFile.create(project, {
        fileRef: productRef,
        settings: { ATTRIBUTES: ['RemoveHeadersOnCopy'] },
      });
      target = project.rootObject.createNativeTarget({
        name: TARGET_NAME,
        productName: TARGET_NAME,
        productReference: productRef,
        productType: WIDGET_PRODUCT_TYPE,
      });
      target.props.buildConfigurationList = createConfigurationListForType(project, {
        type: 'widget',
        name: TARGET_NAME,
        displayName: 'Stills Live Activity',
        cwd: `../targets/${LIVE_ACTIVITY_DIRECTORY}`,
        bundleId: `${clipBundleId}.liveactivities`,
        deploymentTarget: '16.2',
        currentProjectVersion: cfg.ios?.buildNumber ?? 1,
      });
      // Stored for the embedding phase below. This is only needed on creation;
      // on subsequent prebuilds the existing copy phase already owns a file.
      target.__clipExtensionBuildFile = buildFile;
    }

    target.props.productName = TARGET_NAME;
    target.ensureFrameworks(['WidgetKit', 'SwiftUI', 'ActivityKit', 'AppIntents']);
    target.getSourcesBuildPhase();
    target.getResourcesBuildPhase();

    for (const configuration of target.props.buildConfigurationList.props.buildConfigurations) {
      const settings = configuration.props.buildSettings;
      settings.APPLICATION_EXTENSION_API_ONLY = 'YES';
      settings.CODE_SIGN_ENTITLEMENTS = ENTITLEMENTS_PATH;
      settings.CODE_SIGN_STYLE = 'Automatic';
      settings.DEVELOPMENT_TEAM = teamId;
      settings.INFOPLIST_FILE = `../targets/${LIVE_ACTIVITY_DIRECTORY}/Info.plist`;
      settings.IPHONEOS_DEPLOYMENT_TARGET = '16.2';
      settings.PRODUCT_BUNDLE_IDENTIFIER = `${clipBundleId}.liveactivities`;
      settings.PRODUCT_NAME = '$(TARGET_NAME)';
      settings.SKIP_INSTALL = 'YES';
      settings.TARGETED_DEVICE_FAMILY = '1';
    }

    const targetAttributes = (project.rootObject.props.attributes.TargetAttributes ??= {});
    targetAttributes[target.uuid] = {
      ...(targetAttributes[target.uuid] ?? {}),
      CreatedOnToolsVersion: '14.3',
      DevelopmentTeam: teamId,
      ProvisioningStyle: 'Automatic',
    };

    const sharedSourceGroup = findLiveActivitySourceGroup(project, fullWidget);
    if (!target.props.fileSystemSynchronizedGroups) target.props.fileSystemSynchronizedGroups = [];
    if (!target.props.fileSystemSynchronizedGroups.includes(sharedSourceGroup)) {
      target.props.fileSystemSynchronizedGroups.push(sharedSourceGroup);
    }
    ensureTargetSourceMembership(project, sharedSourceGroup, target);

    // The React Native bridge and ActivityAttributes are compiled into both
    // application targets. The extension itself renders the same Swift files
    // via the source group above.
    for (const filename of [
      'LiveActivityModule.swift',
      'LiveActivityModule.m',
      'EventLiveActivityAttributes.swift',
    ]) {
      const fileRef = findFileReference(project, `Stills/${filename}`);
      if (!fileRef) {
        throw new Error(
          `[with-clip-live-activity] Missing ${filename} in the main iOS target. ` +
            'with-live-activity-module must run before this plugin.',
        );
      }
      clipTarget.getSourcesBuildPhase().ensureFile({ fileRef });
    }
    clipTarget.ensureFrameworks(['ActivityKit']);

    let embedPhase = clipTarget.props.buildPhases.find(
      (phase) =>
        PBXCopyFilesBuildPhase.is(phase) &&
        phase.props.files.some((file) => file.props.fileRef === target.props.productReference),
    );
    if (embedPhase) {
      // Earlier manual setup created an unnamed Copy Files phase. Name it so
      // Xcode and build diagnostics describe its purpose accurately.
      embedPhase.props.name = 'Embed Foundation Extensions';
    } else {
      embedPhase = clipTarget.props.buildPhases.find(
        (phase) => PBXCopyFilesBuildPhase.is(phase) && phase.props.name === 'Embed Foundation Extensions',
      );
    }
    if (!embedPhase) {
      embedPhase = clipTarget.createBuildPhase(PBXCopyFilesBuildPhase, {
        name: 'Embed Foundation Extensions',
        dstSubfolderSpec: 13,
        dstPath: '',
        files: [],
      });
    }
    if (!embedPhase.getBuildFile(target.props.productReference)) {
      const buildFile = target.__clipExtensionBuildFile ?? PBXBuildFile.create(project, {
        fileRef: target.props.productReference,
        settings: { ATTRIBUTES: ['RemoveHeadersOnCopy'] },
      });
      embedPhase.props.files.push(buildFile);
    }
    delete target.__clipExtensionBuildFile;
    clipTarget.addDependency(target);

    return cfg;
  });
}

function findLiveActivitySourceGroup(project, fullWidget) {
  const group = fullWidget.props.fileSystemSynchronizedGroups?.find(
    (candidate) =>
      PBXFileSystemSynchronizedRootGroup.is(candidate) &&
      candidate.props.path === LIVE_ACTIVITY_DIRECTORY,
  );
  if (!group) {
    throw new Error('[with-clip-live-activity] Full Live Activity source group is missing.');
  }
  return group;
}

function ensureTargetSourceMembership(project, group, target) {
  const exceptions = (group.props.exceptions ??= []);
  let set = exceptions.find(
    (candidate) =>
      PBXFileSystemSynchronizedBuildFileExceptionSet.is(candidate) && candidate.props.target === target,
  );
  if (!set) {
    set = PBXFileSystemSynchronizedBuildFileExceptionSet.create(project, {
      target,
      membershipExceptions: [],
    });
    exceptions.push(set);
  }
  // These are configuration files, not target source/resources. Fonts and
  // assets must *not* be excluded: this extension needs the exact same visual
  // resources as the full-app Live Activity.
  set.props.membershipExceptions = ['Info.plist', 'expo-target.config.js'];
}

function findFileReference(project, filePath) {
  for (const [, entry] of project.entries()) {
    if (PBXFileReference.is(entry) && entry.props.path === filePath) return entry;
  }
  return null;
}

module.exports = withClipLiveActivity;
