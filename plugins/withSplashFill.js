const { withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const withSplashFill = (config) => {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const splashSource = path.join(projectRoot, 'assets', 'ic_launcher.png');
      const drawableDir = path.join(projectRoot, 'android/app/src/main/res/drawable-nodpi');
      const drawableTarget = path.join(drawableDir, 'splashscreen_image.png');
      const xmlPath = path.join(projectRoot, 'android/app/src/main/res/drawable/ic_launcher_background.xml');

      if (fs.existsSync(splashSource)) {
        fs.mkdirSync(drawableDir, { recursive: true });
        fs.copyFileSync(splashSource, drawableTarget);
      }

      if (!fs.existsSync(xmlPath)) {
        return config;
      }

      let contents = fs.readFileSync(xmlPath, 'utf8');
      const search = /<bitmap\s+android:gravity="[^"]*"\s+android:src="@(drawable|mipmap)\/splashscreen_(logo|image)"\s*\/\>/;
      const replacement = '<bitmap android:gravity="fill" android:src="@drawable/splashscreen_image"/>';

      if (search.test(contents)) {
        contents = contents.replace(search, replacement);
        fs.writeFileSync(xmlPath, contents);
      }

      return config;
    },
  ]);
};

module.exports = withSplashFill;
