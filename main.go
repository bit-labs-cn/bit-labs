package main

import (
	_ "time/tzdata"

	firefly "firefly-cloud/app"

	metricsapp "bit-labs.cn/owl-metrics/app"

	"bit-labs.cn/owl"
	admin "bit-labs.cn/owl-admin/app"
	cms "bit-labs.cn/owl-cms/app"
	comment "bit-labs.cn/owl-comment/app"
	portal "bit-labs.cn/owl-portal/app"
	sms "bit-labs.cn/owl-sms/app"
	coordinator "bit-labs.cn/vlink/coordinator/app"
)

func main() {
	owl.NewApp(
		&portal.SubAppPortal{},
		&cms.SubAppCms{},
		&comment.SubAppComment{},
		&sms.SubAppSms{},
		&firefly.SubAppFirefly{},
		&metricsapp.SubAppMetrics{},
		&coordinator.SubAppCoordinator{},
		&admin.SubAppAdmin{},
	).WebShell()
}
