package app

import (
	"bit-labs.cn/owl"
	"bit-labs.cn/owl/contract/foundation"
	"bit-labs.cn/owl/provider/router"
	"github.com/spf13/cobra"
	"gorm.io/gorm"
)

var _ owl.SubApp = (*SubAppBitLabs)(nil)

// SubAppBitLabs bit-labs 宿主子应用（空壳占位，无业务逻辑）。
type SubAppBitLabs struct {
	app foundation.Application
}

func (s *SubAppBitLabs) Name() string { return "bit-labs" }

func (s *SubAppBitLabs) Bootstrap() {}

func (s *SubAppBitLabs) RegisterMigrate() []any { return nil }

func (s *SubAppBitLabs) BeforeMigrate(db *gorm.DB) error { return nil }

func (s *SubAppBitLabs) AfterMigrate(db *gorm.DB) error { return nil }

func (s *SubAppBitLabs) ServiceProviders() []foundation.ServiceProvider {
	return []foundation.ServiceProvider{}
}

func (s *SubAppBitLabs) RegisterMenus() []*router.Menu { return nil }

func (s *SubAppBitLabs) RegisterCommands() []*cobra.Command { return nil }

func (s *SubAppBitLabs) RegisterRouters() {}

func (s *SubAppBitLabs) Binds() []any { return nil }
