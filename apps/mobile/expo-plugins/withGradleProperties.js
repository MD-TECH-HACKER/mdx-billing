const { withGradleProperties } = require("@expo/config-plugins");

module.exports = function withGradlePropertiesModification(config) {
  return withGradleProperties(config, (config) => {
    const properties = config.modResults;
    const jvmArgs = "-Xmx4096m -XX:MaxMetaspaceSize=1024m";

    const setProperty = (key, value) => {
      const existingProperty = properties.find((p) => p.key === key);
      if (existingProperty) {
        existingProperty.value = value;
      } else {
        properties.push({ type: "property", key, value });
      }
    };

    setProperty("org.gradle.jvmargs", jvmArgs);
    setProperty("newArchEnabled", "true");

    return config;
  });
};
