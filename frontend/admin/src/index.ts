import { defineSubsystem } from "@bit-labs.cn/owl-ui";
import routes from "./routes";
import loginBg from "./assets/login/bg.jpg";

export default defineSubsystem({
  name: "bit-labs",
  routes,
  login: {
    bg: loginBg,
    title: "比特实验室",
    subtitle: "欢迎使用比特实验室后端管理系统",
    primaryColor: "#409EFF"
  }
});
