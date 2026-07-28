import { createFlexAdmin } from "@bit-labs.cn/owl-ui/bootstrap";
import adminSubsystem from "@bit-labs.cn/owl-admin-ui";
import cmsSubsystem from "@bit-labs.cn/owl-cms-ui";
import commentSubsystem from "@bit-labs.cn/owl-comment-ui";
import portalSubsystem from "@bit-labs.cn/owl-portal-ui";
import smsSubsystem from "@bit-labs.cn/owl-sms-ui";
import fireflySubsystem from "@bit-labs.cn/firefly-cloud-ui";
import metricsSubsystem from "@bit-labs.cn/owl-metrics-ui";

createFlexAdmin({
  subsystems: [
    cmsSubsystem,
    portalSubsystem,
    smsSubsystem,
    fireflySubsystem,
    metricsSubsystem,
    commentSubsystem,
    adminSubsystem
  ]
}).then(app => app.mount("#app"));
