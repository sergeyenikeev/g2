import "./styles.css";
import { App } from "./app/App";
import { createPlatform } from "./platform/factory";

const platform = createPlatform();
const app = new App(platform);
app.init();
