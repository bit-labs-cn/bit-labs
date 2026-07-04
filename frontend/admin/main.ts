import { createFlexAdmin } from "@bit-labs.cn/owl-ui/bootstrap";
import adminSubsystem from "@bit-labs.cn/owl-admin-ui";
import cmsSubsystem from "@bit-labs.cn/owl-cms-ui";
import portalSubsystem from "@bit-labs.cn/owl-portal-ui";
import smsSubsystem from "@bit-labs.cn/owl-sms-ui";
import fireflySubsystem from "@bit-labs.cn/firefly-cloud-ui";

createFlexAdmin({
  subsystems: [cmsSubsystem, portalSubsystem, smsSubsystem, fireflySubsystem, adminSubsystem]
}).then(app => app.mount("#app"));
