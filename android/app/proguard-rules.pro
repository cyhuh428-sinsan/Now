# device_calendar 패키지의 클래스와 멤버들이 난독화되지 않도록 보호
-keep class com.builttoroam.device_calendar.** { *; }

# 안드로이드 시스템과의 통신을 위한 인터페이스 보호
-keep class com.builttoroam.device_calendar.models.** { *; }