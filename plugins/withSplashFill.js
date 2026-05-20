const { withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const withSplashFill = (config) => {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;

      // Debug marker: prove plugin ran during prebuild.
      try {
        fs.writeFileSync(
          path.join(projectRoot, 'android', 'splashfill.plugin-ran.txt'),
          new Date().toISOString() + '\n'
        );
      } catch {
        // ignore
      }

      const splashSource = path.join(projectRoot, 'assets', 'ic_launcher.png');


      const drawableDir = path.join(
        projectRoot,
        'android/app/src/main/res/drawable-nodpi'
      );
      const drawableTarget = path.join(
        drawableDir,
        'splashscreen_image.png'
      );

      const xmlPath = path.join(
        projectRoot,
        'android/app/src/main/res/drawable/ic_launcher_background.xml'
      );

      // 1) Copy splash bitmap into drawable-nodpi so it can be used as the splash layer.
      if (fs.existsSync(splashSource)) {
        fs.mkdirSync(drawableDir, { recursive: true });
        fs.copyFileSync(splashSource, drawableTarget);
      }

      // 2) Patch ic_launcher_background.xml to always reference splashscreen_image with fill gravity.
      if (fs.existsSync(xmlPath)) {
        let contents = fs.readFileSync(xmlPath, 'utf8');
        const search =
          /<bitmap\s+android:gravity="[^"]*"\s+android:src="@(drawable|mipmap)\/splashscreen_(logo|image)"\s*\/>/;
        const replacement =
          '<bitmap android:gravity="fill" android:src="@drawable/splashscreen_image"/>';

        if (search.test(contents)) {
          contents = contents.replace(search, replacement);
          fs.writeFileSync(xmlPath, contents);
        }
      }

      // 3) Patch theme used by splash.
      // Expo generates Theme.App.SplashScreen in values/styles.xml.
      const stylesPath = path.join(
        projectRoot,
        'android/app/src/main/res/values/styles.xml'
      );

      if (fs.existsSync(stylesPath)) {
        let stylesContents = fs.readFileSync(stylesPath, 'utf8');

        // Make the animated icon transparent so it doesn't scale/shrink in the center
        if (stylesContents.includes('name="windowSplashScreenAnimatedIcon"')) {
          stylesContents = stylesContents.replace(
            /<item name="windowSplashScreenAnimatedIcon">.*?<\/item>/g,
            '<item name="windowSplashScreenAnimatedIcon">@android:color/transparent</item>'
          );
        } else {
          stylesContents = stylesContents.replace(
            /<style name="Theme\.App\.SplashScreen" parent="Theme\.SplashScreen">/,
            '<style name="Theme.App.SplashScreen" parent="Theme.SplashScreen">\n    <item name="windowSplashScreenAnimatedIcon">@android:color/transparent</item>'
          );
        }

        // Set the splash screen background to transparent
        if (stylesContents.includes('name="windowSplashScreenBackground"')) {
          stylesContents = stylesContents.replace(
            /<item name="windowSplashScreenBackground">.*?<\/item>/g,
            '<item name="windowSplashScreenBackground">@android:color/transparent</item>'
          );
        } else {
          stylesContents = stylesContents.replace(
            /<style name="Theme\.App\.SplashScreen" parent="Theme\.SplashScreen">/,
            '<style name="Theme.App.SplashScreen" parent="Theme.SplashScreen">\n    <item name="windowSplashScreenBackground">@android:color/transparent</item>'
          );
        }

        // Set the android:windowBackground to draw our full-screen launcher background drawable
        if (stylesContents.includes('name="android:windowBackground"')) {
          stylesContents = stylesContents.replace(
            /<item name="android:windowBackground">.*?<\/item>/g,
            '<item name="android:windowBackground">@drawable/ic_launcher_background</item>'
          );
        } else {
          stylesContents = stylesContents.replace(
            /<style name="Theme\.App\.SplashScreen" parent="Theme\.SplashScreen">/,
            '<style name="Theme.App.SplashScreen" parent="Theme.SplashScreen">\n    <item name="android:windowBackground">@drawable/ic_launcher_background</item>'
          );
        }

        fs.writeFileSync(stylesPath, stylesContents);
      }

      // 4) Additionally patch the splashscreen generated background color so it can’t re-appear on some builds.
      const colorsPath = path.join(
        projectRoot,
        'android/app/src/main/res/values/colors.xml'
      );
      if (fs.existsSync(colorsPath)) {
        let colorsContents = fs.readFileSync(colorsPath, 'utf8');
        colorsContents = colorsContents.replace(
          /<color name="splashscreen_background">.*?<\/color>/g,
          '<color name="splashscreen_background">@android:color/transparent</color>'
        );
        fs.writeFileSync(colorsPath, colorsContents);
      }

      return config;
    },
  ]);
};

module.exports = withSplashFill;

