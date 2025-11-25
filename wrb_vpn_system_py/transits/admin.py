from django.contrib import admin
from .models import TransitAccount, TransitDomain

@admin.register(TransitAccount)
class TransitAccountAdmin(admin.ModelAdmin):
    list_display = ('username', 'balance', 'status', 'created_at', 'updated_at')
    list_filter = ('status', 'created_at')
    search_fields = ('username',)
    readonly_fields = ('created_at', 'updated_at')
    fieldsets = (
        ('基本信息', {
            'fields': ('username', 'password', 'balance', 'status')
        }),
        ('配置信息', {
            'fields': ('traffic', 'rules', 'default_inbound', 'default_outbound')
        }),
        ('时间信息', {
            'fields': ('created_at', 'updated_at')
        }),
    )


@admin.register(TransitDomain)
class TransitDomainAdmin(admin.ModelAdmin):
    list_display = ('name', 'ip', 'domain', 'agent', 'created_at', 'updated_at')
    list_filter = ('agent', 'created_at')
    search_fields = ('name', 'ip', 'domain', 'agent__username')
    readonly_fields = ('created_at', 'updated_at')
    fieldsets = (
        ('基本信息', {
            'fields': ('name', 'ip', 'domain', 'agent')
        }),
        ('时间信息', {
            'fields': ('created_at', 'updated_at')
        }),
    )
