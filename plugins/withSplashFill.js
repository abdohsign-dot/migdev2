const { withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const withSplashFill = (config) => {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const splashSource = path.join(projectRoot, 'assets', 'splash.png');
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

      // Hot-wire styles.xml to use transparent native splash + full-screen windowBackground
      const stylesPath = path.join(projectRoot, 'android/app/src/main/res/values/styles.xml');
      if (fs.existsSync(stylesPath)) {
        let stylesContents = fs.readFileSync(stylesPath, 'utf8');

        // Replace background color with transparent
        stylesContents = stylesContents.replace(
          /<item name="windowSplashScreenBackground">.*?<\/item>/g,
          '<item name="windowSplashScreenBackground">@android:color/transparent</item>'
        );

        // Replace animated icon with transparent
        stylesContents = stylesContents.replace(
          /<item name="windowSplashScreenAnimatedIcon">.*?<\/item>/g,
          '<item name="windowSplashScreenAnimatedIcon">@android:color/transparent</item>'
        );

        // Add windowBackground to show our full-screen drawable through the transparent native layer
        if (!stylesContents.includes('name="android:windowBackground"')) {
          stylesContents = stylesContents.replace(
            /<style name="Theme.App.SplashScreen" parent="Theme.SplashScreen">/,
            '<style name="Theme.App.SplashScreen" parent="Theme.SplashScreen">\n    <item name="android:windowBackground">@drawable/ic_launcher_background</item>'
          );
        }

        fs.writeFileSync(stylesPath, stylesContents);
      }

      return config;
    },
  ]);
};

module.exports = withSplashFill;
