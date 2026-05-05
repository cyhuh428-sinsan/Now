// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'app_database.dart';

// ignore_for_file: type=lint
class $UsersTable extends Users with TableInfo<$UsersTable, User> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $UsersTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _userIdMeta = const VerificationMeta('userId');
  @override
  late final GeneratedColumn<String> userId = GeneratedColumn<String>(
    'user_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _timezoneMeta = const VerificationMeta(
    'timezone',
  );
  @override
  late final GeneratedColumn<String> timezone = GeneratedColumn<String>(
    'timezone',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
    defaultValue: const Constant('Asia/Seoul'),
  );
  static const VerificationMeta _localeMeta = const VerificationMeta('locale');
  @override
  late final GeneratedColumn<String> locale = GeneratedColumn<String>(
    'locale',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _settingsJsonMeta = const VerificationMeta(
    'settingsJson',
  );
  @override
  late final GeneratedColumn<String> settingsJson = GeneratedColumn<String>(
    'settings_json',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
    defaultValue: const Constant('{}'),
  );
  static const VerificationMeta _createdAtMeta = const VerificationMeta(
    'createdAt',
  );
  @override
  late final GeneratedColumn<DateTime> createdAt = GeneratedColumn<DateTime>(
    'created_at',
    aliasedName,
    false,
    type: DriftSqlType.dateTime,
    requiredDuringInsert: false,
    defaultValue: currentDateAndTime,
  );
  static const VerificationMeta _updatedAtMeta = const VerificationMeta(
    'updatedAt',
  );
  @override
  late final GeneratedColumn<DateTime> updatedAt = GeneratedColumn<DateTime>(
    'updated_at',
    aliasedName,
    false,
    type: DriftSqlType.dateTime,
    requiredDuringInsert: false,
    defaultValue: currentDateAndTime,
  );
  @override
  List<GeneratedColumn> get $columns => [
    userId,
    timezone,
    locale,
    settingsJson,
    createdAt,
    updatedAt,
  ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'users';
  @override
  VerificationContext validateIntegrity(
    Insertable<User> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('user_id')) {
      context.handle(
        _userIdMeta,
        userId.isAcceptableOrUnknown(data['user_id']!, _userIdMeta),
      );
    } else if (isInserting) {
      context.missing(_userIdMeta);
    }
    if (data.containsKey('timezone')) {
      context.handle(
        _timezoneMeta,
        timezone.isAcceptableOrUnknown(data['timezone']!, _timezoneMeta),
      );
    }
    if (data.containsKey('locale')) {
      context.handle(
        _localeMeta,
        locale.isAcceptableOrUnknown(data['locale']!, _localeMeta),
      );
    }
    if (data.containsKey('settings_json')) {
      context.handle(
        _settingsJsonMeta,
        settingsJson.isAcceptableOrUnknown(
          data['settings_json']!,
          _settingsJsonMeta,
        ),
      );
    }
    if (data.containsKey('created_at')) {
      context.handle(
        _createdAtMeta,
        createdAt.isAcceptableOrUnknown(data['created_at']!, _createdAtMeta),
      );
    }
    if (data.containsKey('updated_at')) {
      context.handle(
        _updatedAtMeta,
        updatedAt.isAcceptableOrUnknown(data['updated_at']!, _updatedAtMeta),
      );
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {userId};
  @override
  User map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return User(
      userId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}user_id'],
      )!,
      timezone: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}timezone'],
      )!,
      locale: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}locale'],
      ),
      settingsJson: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}settings_json'],
      )!,
      createdAt: attachedDatabase.typeMapping.read(
        DriftSqlType.dateTime,
        data['${effectivePrefix}created_at'],
      )!,
      updatedAt: attachedDatabase.typeMapping.read(
        DriftSqlType.dateTime,
        data['${effectivePrefix}updated_at'],
      )!,
    );
  }

  @override
  $UsersTable createAlias(String alias) {
    return $UsersTable(attachedDatabase, alias);
  }
}

class User extends DataClass implements Insertable<User> {
  final String userId;
  final String timezone;
  final String? locale;
  final String settingsJson;
  final DateTime createdAt;
  final DateTime updatedAt;
  const User({
    required this.userId,
    required this.timezone,
    this.locale,
    required this.settingsJson,
    required this.createdAt,
    required this.updatedAt,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['user_id'] = Variable<String>(userId);
    map['timezone'] = Variable<String>(timezone);
    if (!nullToAbsent || locale != null) {
      map['locale'] = Variable<String>(locale);
    }
    map['settings_json'] = Variable<String>(settingsJson);
    map['created_at'] = Variable<DateTime>(createdAt);
    map['updated_at'] = Variable<DateTime>(updatedAt);
    return map;
  }

  UsersCompanion toCompanion(bool nullToAbsent) {
    return UsersCompanion(
      userId: Value(userId),
      timezone: Value(timezone),
      locale: locale == null && nullToAbsent
          ? const Value.absent()
          : Value(locale),
      settingsJson: Value(settingsJson),
      createdAt: Value(createdAt),
      updatedAt: Value(updatedAt),
    );
  }

  factory User.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return User(
      userId: serializer.fromJson<String>(json['userId']),
      timezone: serializer.fromJson<String>(json['timezone']),
      locale: serializer.fromJson<String?>(json['locale']),
      settingsJson: serializer.fromJson<String>(json['settingsJson']),
      createdAt: serializer.fromJson<DateTime>(json['createdAt']),
      updatedAt: serializer.fromJson<DateTime>(json['updatedAt']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'userId': serializer.toJson<String>(userId),
      'timezone': serializer.toJson<String>(timezone),
      'locale': serializer.toJson<String?>(locale),
      'settingsJson': serializer.toJson<String>(settingsJson),
      'createdAt': serializer.toJson<DateTime>(createdAt),
      'updatedAt': serializer.toJson<DateTime>(updatedAt),
    };
  }

  User copyWith({
    String? userId,
    String? timezone,
    Value<String?> locale = const Value.absent(),
    String? settingsJson,
    DateTime? createdAt,
    DateTime? updatedAt,
  }) => User(
    userId: userId ?? this.userId,
    timezone: timezone ?? this.timezone,
    locale: locale.present ? locale.value : this.locale,
    settingsJson: settingsJson ?? this.settingsJson,
    createdAt: createdAt ?? this.createdAt,
    updatedAt: updatedAt ?? this.updatedAt,
  );
  User copyWithCompanion(UsersCompanion data) {
    return User(
      userId: data.userId.present ? data.userId.value : this.userId,
      timezone: data.timezone.present ? data.timezone.value : this.timezone,
      locale: data.locale.present ? data.locale.value : this.locale,
      settingsJson: data.settingsJson.present
          ? data.settingsJson.value
          : this.settingsJson,
      createdAt: data.createdAt.present ? data.createdAt.value : this.createdAt,
      updatedAt: data.updatedAt.present ? data.updatedAt.value : this.updatedAt,
    );
  }

  @override
  String toString() {
    return (StringBuffer('User(')
          ..write('userId: $userId, ')
          ..write('timezone: $timezone, ')
          ..write('locale: $locale, ')
          ..write('settingsJson: $settingsJson, ')
          ..write('createdAt: $createdAt, ')
          ..write('updatedAt: $updatedAt')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode =>
      Object.hash(userId, timezone, locale, settingsJson, createdAt, updatedAt);
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is User &&
          other.userId == this.userId &&
          other.timezone == this.timezone &&
          other.locale == this.locale &&
          other.settingsJson == this.settingsJson &&
          other.createdAt == this.createdAt &&
          other.updatedAt == this.updatedAt);
}

class UsersCompanion extends UpdateCompanion<User> {
  final Value<String> userId;
  final Value<String> timezone;
  final Value<String?> locale;
  final Value<String> settingsJson;
  final Value<DateTime> createdAt;
  final Value<DateTime> updatedAt;
  final Value<int> rowid;
  const UsersCompanion({
    this.userId = const Value.absent(),
    this.timezone = const Value.absent(),
    this.locale = const Value.absent(),
    this.settingsJson = const Value.absent(),
    this.createdAt = const Value.absent(),
    this.updatedAt = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  UsersCompanion.insert({
    required String userId,
    this.timezone = const Value.absent(),
    this.locale = const Value.absent(),
    this.settingsJson = const Value.absent(),
    this.createdAt = const Value.absent(),
    this.updatedAt = const Value.absent(),
    this.rowid = const Value.absent(),
  }) : userId = Value(userId);
  static Insertable<User> custom({
    Expression<String>? userId,
    Expression<String>? timezone,
    Expression<String>? locale,
    Expression<String>? settingsJson,
    Expression<DateTime>? createdAt,
    Expression<DateTime>? updatedAt,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (userId != null) 'user_id': userId,
      if (timezone != null) 'timezone': timezone,
      if (locale != null) 'locale': locale,
      if (settingsJson != null) 'settings_json': settingsJson,
      if (createdAt != null) 'created_at': createdAt,
      if (updatedAt != null) 'updated_at': updatedAt,
      if (rowid != null) 'rowid': rowid,
    });
  }

  UsersCompanion copyWith({
    Value<String>? userId,
    Value<String>? timezone,
    Value<String?>? locale,
    Value<String>? settingsJson,
    Value<DateTime>? createdAt,
    Value<DateTime>? updatedAt,
    Value<int>? rowid,
  }) {
    return UsersCompanion(
      userId: userId ?? this.userId,
      timezone: timezone ?? this.timezone,
      locale: locale ?? this.locale,
      settingsJson: settingsJson ?? this.settingsJson,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (userId.present) {
      map['user_id'] = Variable<String>(userId.value);
    }
    if (timezone.present) {
      map['timezone'] = Variable<String>(timezone.value);
    }
    if (locale.present) {
      map['locale'] = Variable<String>(locale.value);
    }
    if (settingsJson.present) {
      map['settings_json'] = Variable<String>(settingsJson.value);
    }
    if (createdAt.present) {
      map['created_at'] = Variable<DateTime>(createdAt.value);
    }
    if (updatedAt.present) {
      map['updated_at'] = Variable<DateTime>(updatedAt.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('UsersCompanion(')
          ..write('userId: $userId, ')
          ..write('timezone: $timezone, ')
          ..write('locale: $locale, ')
          ..write('settingsJson: $settingsJson, ')
          ..write('createdAt: $createdAt, ')
          ..write('updatedAt: $updatedAt, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $CalendarEventsTable extends CalendarEvents
    with TableInfo<$CalendarEventsTable, CalendarEvent> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $CalendarEventsTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _calendarEventIdMeta = const VerificationMeta(
    'calendarEventId',
  );
  @override
  late final GeneratedColumn<String> calendarEventId = GeneratedColumn<String>(
    'calendar_event_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _userIdMeta = const VerificationMeta('userId');
  @override
  late final GeneratedColumn<String> userId = GeneratedColumn<String>(
    'user_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _titleMeta = const VerificationMeta('title');
  @override
  late final GeneratedColumn<String> title = GeneratedColumn<String>(
    'title',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _startTimeMeta = const VerificationMeta(
    'startTime',
  );
  @override
  late final GeneratedColumn<DateTime> startTime = GeneratedColumn<DateTime>(
    'start_time',
    aliasedName,
    false,
    type: DriftSqlType.dateTime,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _endTimeMeta = const VerificationMeta(
    'endTime',
  );
  @override
  late final GeneratedColumn<DateTime> endTime = GeneratedColumn<DateTime>(
    'end_time',
    aliasedName,
    false,
    type: DriftSqlType.dateTime,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _locationMeta = const VerificationMeta(
    'location',
  );
  @override
  late final GeneratedColumn<String> location = GeneratedColumn<String>(
    'location',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _categoryMeta = const VerificationMeta(
    'category',
  );
  @override
  late final GeneratedColumn<String> category = GeneratedColumn<String>(
    'category',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _sourceMeta = const VerificationMeta('source');
  @override
  late final GeneratedColumn<String> source = GeneratedColumn<String>(
    'source',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
    defaultValue: const Constant('manual'),
  );
  static const VerificationMeta _createdAtMeta = const VerificationMeta(
    'createdAt',
  );
  @override
  late final GeneratedColumn<DateTime> createdAt = GeneratedColumn<DateTime>(
    'created_at',
    aliasedName,
    false,
    type: DriftSqlType.dateTime,
    requiredDuringInsert: false,
    defaultValue: currentDateAndTime,
  );
  @override
  List<GeneratedColumn> get $columns => [
    calendarEventId,
    userId,
    title,
    startTime,
    endTime,
    location,
    category,
    source,
    createdAt,
  ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'calendar_events';
  @override
  VerificationContext validateIntegrity(
    Insertable<CalendarEvent> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('calendar_event_id')) {
      context.handle(
        _calendarEventIdMeta,
        calendarEventId.isAcceptableOrUnknown(
          data['calendar_event_id']!,
          _calendarEventIdMeta,
        ),
      );
    } else if (isInserting) {
      context.missing(_calendarEventIdMeta);
    }
    if (data.containsKey('user_id')) {
      context.handle(
        _userIdMeta,
        userId.isAcceptableOrUnknown(data['user_id']!, _userIdMeta),
      );
    } else if (isInserting) {
      context.missing(_userIdMeta);
    }
    if (data.containsKey('title')) {
      context.handle(
        _titleMeta,
        title.isAcceptableOrUnknown(data['title']!, _titleMeta),
      );
    } else if (isInserting) {
      context.missing(_titleMeta);
    }
    if (data.containsKey('start_time')) {
      context.handle(
        _startTimeMeta,
        startTime.isAcceptableOrUnknown(data['start_time']!, _startTimeMeta),
      );
    } else if (isInserting) {
      context.missing(_startTimeMeta);
    }
    if (data.containsKey('end_time')) {
      context.handle(
        _endTimeMeta,
        endTime.isAcceptableOrUnknown(data['end_time']!, _endTimeMeta),
      );
    } else if (isInserting) {
      context.missing(_endTimeMeta);
    }
    if (data.containsKey('location')) {
      context.handle(
        _locationMeta,
        location.isAcceptableOrUnknown(data['location']!, _locationMeta),
      );
    }
    if (data.containsKey('category')) {
      context.handle(
        _categoryMeta,
        category.isAcceptableOrUnknown(data['category']!, _categoryMeta),
      );
    }
    if (data.containsKey('source')) {
      context.handle(
        _sourceMeta,
        source.isAcceptableOrUnknown(data['source']!, _sourceMeta),
      );
    }
    if (data.containsKey('created_at')) {
      context.handle(
        _createdAtMeta,
        createdAt.isAcceptableOrUnknown(data['created_at']!, _createdAtMeta),
      );
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {calendarEventId};
  @override
  CalendarEvent map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return CalendarEvent(
      calendarEventId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}calendar_event_id'],
      )!,
      userId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}user_id'],
      )!,
      title: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}title'],
      )!,
      startTime: attachedDatabase.typeMapping.read(
        DriftSqlType.dateTime,
        data['${effectivePrefix}start_time'],
      )!,
      endTime: attachedDatabase.typeMapping.read(
        DriftSqlType.dateTime,
        data['${effectivePrefix}end_time'],
      )!,
      location: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}location'],
      ),
      category: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}category'],
      ),
      source: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}source'],
      )!,
      createdAt: attachedDatabase.typeMapping.read(
        DriftSqlType.dateTime,
        data['${effectivePrefix}created_at'],
      )!,
    );
  }

  @override
  $CalendarEventsTable createAlias(String alias) {
    return $CalendarEventsTable(attachedDatabase, alias);
  }
}

class CalendarEvent extends DataClass implements Insertable<CalendarEvent> {
  final String calendarEventId;
  final String userId;
  final String title;
  final DateTime startTime;
  final DateTime endTime;
  final String? location;
  final String? category;
  final String source;
  final DateTime createdAt;
  const CalendarEvent({
    required this.calendarEventId,
    required this.userId,
    required this.title,
    required this.startTime,
    required this.endTime,
    this.location,
    this.category,
    required this.source,
    required this.createdAt,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['calendar_event_id'] = Variable<String>(calendarEventId);
    map['user_id'] = Variable<String>(userId);
    map['title'] = Variable<String>(title);
    map['start_time'] = Variable<DateTime>(startTime);
    map['end_time'] = Variable<DateTime>(endTime);
    if (!nullToAbsent || location != null) {
      map['location'] = Variable<String>(location);
    }
    if (!nullToAbsent || category != null) {
      map['category'] = Variable<String>(category);
    }
    map['source'] = Variable<String>(source);
    map['created_at'] = Variable<DateTime>(createdAt);
    return map;
  }

  CalendarEventsCompanion toCompanion(bool nullToAbsent) {
    return CalendarEventsCompanion(
      calendarEventId: Value(calendarEventId),
      userId: Value(userId),
      title: Value(title),
      startTime: Value(startTime),
      endTime: Value(endTime),
      location: location == null && nullToAbsent
          ? const Value.absent()
          : Value(location),
      category: category == null && nullToAbsent
          ? const Value.absent()
          : Value(category),
      source: Value(source),
      createdAt: Value(createdAt),
    );
  }

  factory CalendarEvent.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return CalendarEvent(
      calendarEventId: serializer.fromJson<String>(json['calendarEventId']),
      userId: serializer.fromJson<String>(json['userId']),
      title: serializer.fromJson<String>(json['title']),
      startTime: serializer.fromJson<DateTime>(json['startTime']),
      endTime: serializer.fromJson<DateTime>(json['endTime']),
      location: serializer.fromJson<String?>(json['location']),
      category: serializer.fromJson<String?>(json['category']),
      source: serializer.fromJson<String>(json['source']),
      createdAt: serializer.fromJson<DateTime>(json['createdAt']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'calendarEventId': serializer.toJson<String>(calendarEventId),
      'userId': serializer.toJson<String>(userId),
      'title': serializer.toJson<String>(title),
      'startTime': serializer.toJson<DateTime>(startTime),
      'endTime': serializer.toJson<DateTime>(endTime),
      'location': serializer.toJson<String?>(location),
      'category': serializer.toJson<String?>(category),
      'source': serializer.toJson<String>(source),
      'createdAt': serializer.toJson<DateTime>(createdAt),
    };
  }

  CalendarEvent copyWith({
    String? calendarEventId,
    String? userId,
    String? title,
    DateTime? startTime,
    DateTime? endTime,
    Value<String?> location = const Value.absent(),
    Value<String?> category = const Value.absent(),
    String? source,
    DateTime? createdAt,
  }) => CalendarEvent(
    calendarEventId: calendarEventId ?? this.calendarEventId,
    userId: userId ?? this.userId,
    title: title ?? this.title,
    startTime: startTime ?? this.startTime,
    endTime: endTime ?? this.endTime,
    location: location.present ? location.value : this.location,
    category: category.present ? category.value : this.category,
    source: source ?? this.source,
    createdAt: createdAt ?? this.createdAt,
  );
  CalendarEvent copyWithCompanion(CalendarEventsCompanion data) {
    return CalendarEvent(
      calendarEventId: data.calendarEventId.present
          ? data.calendarEventId.value
          : this.calendarEventId,
      userId: data.userId.present ? data.userId.value : this.userId,
      title: data.title.present ? data.title.value : this.title,
      startTime: data.startTime.present ? data.startTime.value : this.startTime,
      endTime: data.endTime.present ? data.endTime.value : this.endTime,
      location: data.location.present ? data.location.value : this.location,
      category: data.category.present ? data.category.value : this.category,
      source: data.source.present ? data.source.value : this.source,
      createdAt: data.createdAt.present ? data.createdAt.value : this.createdAt,
    );
  }

  @override
  String toString() {
    return (StringBuffer('CalendarEvent(')
          ..write('calendarEventId: $calendarEventId, ')
          ..write('userId: $userId, ')
          ..write('title: $title, ')
          ..write('startTime: $startTime, ')
          ..write('endTime: $endTime, ')
          ..write('location: $location, ')
          ..write('category: $category, ')
          ..write('source: $source, ')
          ..write('createdAt: $createdAt')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(
    calendarEventId,
    userId,
    title,
    startTime,
    endTime,
    location,
    category,
    source,
    createdAt,
  );
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is CalendarEvent &&
          other.calendarEventId == this.calendarEventId &&
          other.userId == this.userId &&
          other.title == this.title &&
          other.startTime == this.startTime &&
          other.endTime == this.endTime &&
          other.location == this.location &&
          other.category == this.category &&
          other.source == this.source &&
          other.createdAt == this.createdAt);
}

class CalendarEventsCompanion extends UpdateCompanion<CalendarEvent> {
  final Value<String> calendarEventId;
  final Value<String> userId;
  final Value<String> title;
  final Value<DateTime> startTime;
  final Value<DateTime> endTime;
  final Value<String?> location;
  final Value<String?> category;
  final Value<String> source;
  final Value<DateTime> createdAt;
  final Value<int> rowid;
  const CalendarEventsCompanion({
    this.calendarEventId = const Value.absent(),
    this.userId = const Value.absent(),
    this.title = const Value.absent(),
    this.startTime = const Value.absent(),
    this.endTime = const Value.absent(),
    this.location = const Value.absent(),
    this.category = const Value.absent(),
    this.source = const Value.absent(),
    this.createdAt = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  CalendarEventsCompanion.insert({
    required String calendarEventId,
    required String userId,
    required String title,
    required DateTime startTime,
    required DateTime endTime,
    this.location = const Value.absent(),
    this.category = const Value.absent(),
    this.source = const Value.absent(),
    this.createdAt = const Value.absent(),
    this.rowid = const Value.absent(),
  }) : calendarEventId = Value(calendarEventId),
       userId = Value(userId),
       title = Value(title),
       startTime = Value(startTime),
       endTime = Value(endTime);
  static Insertable<CalendarEvent> custom({
    Expression<String>? calendarEventId,
    Expression<String>? userId,
    Expression<String>? title,
    Expression<DateTime>? startTime,
    Expression<DateTime>? endTime,
    Expression<String>? location,
    Expression<String>? category,
    Expression<String>? source,
    Expression<DateTime>? createdAt,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (calendarEventId != null) 'calendar_event_id': calendarEventId,
      if (userId != null) 'user_id': userId,
      if (title != null) 'title': title,
      if (startTime != null) 'start_time': startTime,
      if (endTime != null) 'end_time': endTime,
      if (location != null) 'location': location,
      if (category != null) 'category': category,
      if (source != null) 'source': source,
      if (createdAt != null) 'created_at': createdAt,
      if (rowid != null) 'rowid': rowid,
    });
  }

  CalendarEventsCompanion copyWith({
    Value<String>? calendarEventId,
    Value<String>? userId,
    Value<String>? title,
    Value<DateTime>? startTime,
    Value<DateTime>? endTime,
    Value<String?>? location,
    Value<String?>? category,
    Value<String>? source,
    Value<DateTime>? createdAt,
    Value<int>? rowid,
  }) {
    return CalendarEventsCompanion(
      calendarEventId: calendarEventId ?? this.calendarEventId,
      userId: userId ?? this.userId,
      title: title ?? this.title,
      startTime: startTime ?? this.startTime,
      endTime: endTime ?? this.endTime,
      location: location ?? this.location,
      category: category ?? this.category,
      source: source ?? this.source,
      createdAt: createdAt ?? this.createdAt,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (calendarEventId.present) {
      map['calendar_event_id'] = Variable<String>(calendarEventId.value);
    }
    if (userId.present) {
      map['user_id'] = Variable<String>(userId.value);
    }
    if (title.present) {
      map['title'] = Variable<String>(title.value);
    }
    if (startTime.present) {
      map['start_time'] = Variable<DateTime>(startTime.value);
    }
    if (endTime.present) {
      map['end_time'] = Variable<DateTime>(endTime.value);
    }
    if (location.present) {
      map['location'] = Variable<String>(location.value);
    }
    if (category.present) {
      map['category'] = Variable<String>(category.value);
    }
    if (source.present) {
      map['source'] = Variable<String>(source.value);
    }
    if (createdAt.present) {
      map['created_at'] = Variable<DateTime>(createdAt.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('CalendarEventsCompanion(')
          ..write('calendarEventId: $calendarEventId, ')
          ..write('userId: $userId, ')
          ..write('title: $title, ')
          ..write('startTime: $startTime, ')
          ..write('endTime: $endTime, ')
          ..write('location: $location, ')
          ..write('category: $category, ')
          ..write('source: $source, ')
          ..write('createdAt: $createdAt, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $MeetingsTable extends Meetings with TableInfo<$MeetingsTable, Meeting> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $MeetingsTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _meetingIdMeta = const VerificationMeta(
    'meetingId',
  );
  @override
  late final GeneratedColumn<String> meetingId = GeneratedColumn<String>(
    'meeting_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _calendarEventIdMeta = const VerificationMeta(
    'calendarEventId',
  );
  @override
  late final GeneratedColumn<String> calendarEventId = GeneratedColumn<String>(
    'calendar_event_id',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _titleMeta = const VerificationMeta('title');
  @override
  late final GeneratedColumn<String> title = GeneratedColumn<String>(
    'title',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
    defaultValue: const Constant(''),
  );
  static const VerificationMeta _statusMeta = const VerificationMeta('status');
  @override
  late final GeneratedColumn<String> status = GeneratedColumn<String>(
    'status',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
    defaultValue: const Constant('planned'),
  );
  static const VerificationMeta _recordTypeMeta = const VerificationMeta(
    'recordType',
  );
  @override
  late final GeneratedColumn<String> recordType = GeneratedColumn<String>(
    'record_type',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
    defaultValue: const Constant('meeting'),
  );
  static const VerificationMeta _participantNameMeta = const VerificationMeta(
    'participantName',
  );
  @override
  late final GeneratedColumn<String> participantName = GeneratedColumn<String>(
    'participant_name',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _startedAtMeta = const VerificationMeta(
    'startedAt',
  );
  @override
  late final GeneratedColumn<DateTime> startedAt = GeneratedColumn<DateTime>(
    'started_at',
    aliasedName,
    true,
    type: DriftSqlType.dateTime,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _endedAtMeta = const VerificationMeta(
    'endedAt',
  );
  @override
  late final GeneratedColumn<DateTime> endedAt = GeneratedColumn<DateTime>(
    'ended_at',
    aliasedName,
    true,
    type: DriftSqlType.dateTime,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _summaryMeta = const VerificationMeta(
    'summary',
  );
  @override
  late final GeneratedColumn<String> summary = GeneratedColumn<String>(
    'summary',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _segmentCountMeta = const VerificationMeta(
    'segmentCount',
  );
  @override
  late final GeneratedColumn<int> segmentCount = GeneratedColumn<int>(
    'segment_count',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
    defaultValue: const Constant(0),
  );
  static const VerificationMeta _actionCountMeta = const VerificationMeta(
    'actionCount',
  );
  @override
  late final GeneratedColumn<int> actionCount = GeneratedColumn<int>(
    'action_count',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
    defaultValue: const Constant(0),
  );
  static const VerificationMeta _decisionCountMeta = const VerificationMeta(
    'decisionCount',
  );
  @override
  late final GeneratedColumn<int> decisionCount = GeneratedColumn<int>(
    'decision_count',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
    defaultValue: const Constant(0),
  );
  static const VerificationMeta _isImportantMeta = const VerificationMeta(
    'isImportant',
  );
  @override
  late final GeneratedColumn<bool> isImportant = GeneratedColumn<bool>(
    'is_important',
    aliasedName,
    false,
    type: DriftSqlType.bool,
    requiredDuringInsert: false,
    defaultConstraints: GeneratedColumn.constraintIsAlways(
      'CHECK ("is_important" IN (0, 1))',
    ),
    defaultValue: const Constant(false),
  );
  static const VerificationMeta _createdAtMeta = const VerificationMeta(
    'createdAt',
  );
  @override
  late final GeneratedColumn<DateTime> createdAt = GeneratedColumn<DateTime>(
    'created_at',
    aliasedName,
    false,
    type: DriftSqlType.dateTime,
    requiredDuringInsert: false,
    defaultValue: currentDateAndTime,
  );
  static const VerificationMeta _updatedAtMeta = const VerificationMeta(
    'updatedAt',
  );
  @override
  late final GeneratedColumn<DateTime> updatedAt = GeneratedColumn<DateTime>(
    'updated_at',
    aliasedName,
    false,
    type: DriftSqlType.dateTime,
    requiredDuringInsert: false,
    defaultValue: currentDateAndTime,
  );
  @override
  List<GeneratedColumn> get $columns => [
    meetingId,
    calendarEventId,
    title,
    status,
    recordType,
    participantName,
    startedAt,
    endedAt,
    summary,
    segmentCount,
    actionCount,
    decisionCount,
    isImportant,
    createdAt,
    updatedAt,
  ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'meetings';
  @override
  VerificationContext validateIntegrity(
    Insertable<Meeting> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('meeting_id')) {
      context.handle(
        _meetingIdMeta,
        meetingId.isAcceptableOrUnknown(data['meeting_id']!, _meetingIdMeta),
      );
    } else if (isInserting) {
      context.missing(_meetingIdMeta);
    }
    if (data.containsKey('calendar_event_id')) {
      context.handle(
        _calendarEventIdMeta,
        calendarEventId.isAcceptableOrUnknown(
          data['calendar_event_id']!,
          _calendarEventIdMeta,
        ),
      );
    }
    if (data.containsKey('title')) {
      context.handle(
        _titleMeta,
        title.isAcceptableOrUnknown(data['title']!, _titleMeta),
      );
    }
    if (data.containsKey('status')) {
      context.handle(
        _statusMeta,
        status.isAcceptableOrUnknown(data['status']!, _statusMeta),
      );
    }
    if (data.containsKey('record_type')) {
      context.handle(
        _recordTypeMeta,
        recordType.isAcceptableOrUnknown(data['record_type']!, _recordTypeMeta),
      );
    }
    if (data.containsKey('participant_name')) {
      context.handle(
        _participantNameMeta,
        participantName.isAcceptableOrUnknown(
          data['participant_name']!,
          _participantNameMeta,
        ),
      );
    }
    if (data.containsKey('started_at')) {
      context.handle(
        _startedAtMeta,
        startedAt.isAcceptableOrUnknown(data['started_at']!, _startedAtMeta),
      );
    }
    if (data.containsKey('ended_at')) {
      context.handle(
        _endedAtMeta,
        endedAt.isAcceptableOrUnknown(data['ended_at']!, _endedAtMeta),
      );
    }
    if (data.containsKey('summary')) {
      context.handle(
        _summaryMeta,
        summary.isAcceptableOrUnknown(data['summary']!, _summaryMeta),
      );
    }
    if (data.containsKey('segment_count')) {
      context.handle(
        _segmentCountMeta,
        segmentCount.isAcceptableOrUnknown(
          data['segment_count']!,
          _segmentCountMeta,
        ),
      );
    }
    if (data.containsKey('action_count')) {
      context.handle(
        _actionCountMeta,
        actionCount.isAcceptableOrUnknown(
          data['action_count']!,
          _actionCountMeta,
        ),
      );
    }
    if (data.containsKey('decision_count')) {
      context.handle(
        _decisionCountMeta,
        decisionCount.isAcceptableOrUnknown(
          data['decision_count']!,
          _decisionCountMeta,
        ),
      );
    }
    if (data.containsKey('is_important')) {
      context.handle(
        _isImportantMeta,
        isImportant.isAcceptableOrUnknown(
          data['is_important']!,
          _isImportantMeta,
        ),
      );
    }
    if (data.containsKey('created_at')) {
      context.handle(
        _createdAtMeta,
        createdAt.isAcceptableOrUnknown(data['created_at']!, _createdAtMeta),
      );
    }
    if (data.containsKey('updated_at')) {
      context.handle(
        _updatedAtMeta,
        updatedAt.isAcceptableOrUnknown(data['updated_at']!, _updatedAtMeta),
      );
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {meetingId};
  @override
  Meeting map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return Meeting(
      meetingId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}meeting_id'],
      )!,
      calendarEventId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}calendar_event_id'],
      ),
      title: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}title'],
      )!,
      status: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}status'],
      )!,
      recordType: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}record_type'],
      )!,
      participantName: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}participant_name'],
      ),
      startedAt: attachedDatabase.typeMapping.read(
        DriftSqlType.dateTime,
        data['${effectivePrefix}started_at'],
      ),
      endedAt: attachedDatabase.typeMapping.read(
        DriftSqlType.dateTime,
        data['${effectivePrefix}ended_at'],
      ),
      summary: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}summary'],
      ),
      segmentCount: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}segment_count'],
      )!,
      actionCount: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}action_count'],
      )!,
      decisionCount: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}decision_count'],
      )!,
      isImportant: attachedDatabase.typeMapping.read(
        DriftSqlType.bool,
        data['${effectivePrefix}is_important'],
      )!,
      createdAt: attachedDatabase.typeMapping.read(
        DriftSqlType.dateTime,
        data['${effectivePrefix}created_at'],
      )!,
      updatedAt: attachedDatabase.typeMapping.read(
        DriftSqlType.dateTime,
        data['${effectivePrefix}updated_at'],
      )!,
    );
  }

  @override
  $MeetingsTable createAlias(String alias) {
    return $MeetingsTable(attachedDatabase, alias);
  }
}

class Meeting extends DataClass implements Insertable<Meeting> {
  final String meetingId;
  final String? calendarEventId;
  final String title;
  final String status;
  final String recordType;
  final String? participantName;
  final DateTime? startedAt;
  final DateTime? endedAt;
  final String? summary;
  final int segmentCount;
  final int actionCount;
  final int decisionCount;
  final bool isImportant;
  final DateTime createdAt;
  final DateTime updatedAt;
  const Meeting({
    required this.meetingId,
    this.calendarEventId,
    required this.title,
    required this.status,
    required this.recordType,
    this.participantName,
    this.startedAt,
    this.endedAt,
    this.summary,
    required this.segmentCount,
    required this.actionCount,
    required this.decisionCount,
    required this.isImportant,
    required this.createdAt,
    required this.updatedAt,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['meeting_id'] = Variable<String>(meetingId);
    if (!nullToAbsent || calendarEventId != null) {
      map['calendar_event_id'] = Variable<String>(calendarEventId);
    }
    map['title'] = Variable<String>(title);
    map['status'] = Variable<String>(status);
    map['record_type'] = Variable<String>(recordType);
    if (!nullToAbsent || participantName != null) {
      map['participant_name'] = Variable<String>(participantName);
    }
    if (!nullToAbsent || startedAt != null) {
      map['started_at'] = Variable<DateTime>(startedAt);
    }
    if (!nullToAbsent || endedAt != null) {
      map['ended_at'] = Variable<DateTime>(endedAt);
    }
    if (!nullToAbsent || summary != null) {
      map['summary'] = Variable<String>(summary);
    }
    map['segment_count'] = Variable<int>(segmentCount);
    map['action_count'] = Variable<int>(actionCount);
    map['decision_count'] = Variable<int>(decisionCount);
    map['is_important'] = Variable<bool>(isImportant);
    map['created_at'] = Variable<DateTime>(createdAt);
    map['updated_at'] = Variable<DateTime>(updatedAt);
    return map;
  }

  MeetingsCompanion toCompanion(bool nullToAbsent) {
    return MeetingsCompanion(
      meetingId: Value(meetingId),
      calendarEventId: calendarEventId == null && nullToAbsent
          ? const Value.absent()
          : Value(calendarEventId),
      title: Value(title),
      status: Value(status),
      recordType: Value(recordType),
      participantName: participantName == null && nullToAbsent
          ? const Value.absent()
          : Value(participantName),
      startedAt: startedAt == null && nullToAbsent
          ? const Value.absent()
          : Value(startedAt),
      endedAt: endedAt == null && nullToAbsent
          ? const Value.absent()
          : Value(endedAt),
      summary: summary == null && nullToAbsent
          ? const Value.absent()
          : Value(summary),
      segmentCount: Value(segmentCount),
      actionCount: Value(actionCount),
      decisionCount: Value(decisionCount),
      isImportant: Value(isImportant),
      createdAt: Value(createdAt),
      updatedAt: Value(updatedAt),
    );
  }

  factory Meeting.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return Meeting(
      meetingId: serializer.fromJson<String>(json['meetingId']),
      calendarEventId: serializer.fromJson<String?>(json['calendarEventId']),
      title: serializer.fromJson<String>(json['title']),
      status: serializer.fromJson<String>(json['status']),
      recordType: serializer.fromJson<String>(json['recordType']),
      participantName: serializer.fromJson<String?>(json['participantName']),
      startedAt: serializer.fromJson<DateTime?>(json['startedAt']),
      endedAt: serializer.fromJson<DateTime?>(json['endedAt']),
      summary: serializer.fromJson<String?>(json['summary']),
      segmentCount: serializer.fromJson<int>(json['segmentCount']),
      actionCount: serializer.fromJson<int>(json['actionCount']),
      decisionCount: serializer.fromJson<int>(json['decisionCount']),
      isImportant: serializer.fromJson<bool>(json['isImportant']),
      createdAt: serializer.fromJson<DateTime>(json['createdAt']),
      updatedAt: serializer.fromJson<DateTime>(json['updatedAt']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'meetingId': serializer.toJson<String>(meetingId),
      'calendarEventId': serializer.toJson<String?>(calendarEventId),
      'title': serializer.toJson<String>(title),
      'status': serializer.toJson<String>(status),
      'recordType': serializer.toJson<String>(recordType),
      'participantName': serializer.toJson<String?>(participantName),
      'startedAt': serializer.toJson<DateTime?>(startedAt),
      'endedAt': serializer.toJson<DateTime?>(endedAt),
      'summary': serializer.toJson<String?>(summary),
      'segmentCount': serializer.toJson<int>(segmentCount),
      'actionCount': serializer.toJson<int>(actionCount),
      'decisionCount': serializer.toJson<int>(decisionCount),
      'isImportant': serializer.toJson<bool>(isImportant),
      'createdAt': serializer.toJson<DateTime>(createdAt),
      'updatedAt': serializer.toJson<DateTime>(updatedAt),
    };
  }

  Meeting copyWith({
    String? meetingId,
    Value<String?> calendarEventId = const Value.absent(),
    String? title,
    String? status,
    String? recordType,
    Value<String?> participantName = const Value.absent(),
    Value<DateTime?> startedAt = const Value.absent(),
    Value<DateTime?> endedAt = const Value.absent(),
    Value<String?> summary = const Value.absent(),
    int? segmentCount,
    int? actionCount,
    int? decisionCount,
    bool? isImportant,
    DateTime? createdAt,
    DateTime? updatedAt,
  }) => Meeting(
    meetingId: meetingId ?? this.meetingId,
    calendarEventId: calendarEventId.present
        ? calendarEventId.value
        : this.calendarEventId,
    title: title ?? this.title,
    status: status ?? this.status,
    recordType: recordType ?? this.recordType,
    participantName: participantName.present
        ? participantName.value
        : this.participantName,
    startedAt: startedAt.present ? startedAt.value : this.startedAt,
    endedAt: endedAt.present ? endedAt.value : this.endedAt,
    summary: summary.present ? summary.value : this.summary,
    segmentCount: segmentCount ?? this.segmentCount,
    actionCount: actionCount ?? this.actionCount,
    decisionCount: decisionCount ?? this.decisionCount,
    isImportant: isImportant ?? this.isImportant,
    createdAt: createdAt ?? this.createdAt,
    updatedAt: updatedAt ?? this.updatedAt,
  );
  Meeting copyWithCompanion(MeetingsCompanion data) {
    return Meeting(
      meetingId: data.meetingId.present ? data.meetingId.value : this.meetingId,
      calendarEventId: data.calendarEventId.present
          ? data.calendarEventId.value
          : this.calendarEventId,
      title: data.title.present ? data.title.value : this.title,
      status: data.status.present ? data.status.value : this.status,
      recordType: data.recordType.present
          ? data.recordType.value
          : this.recordType,
      participantName: data.participantName.present
          ? data.participantName.value
          : this.participantName,
      startedAt: data.startedAt.present ? data.startedAt.value : this.startedAt,
      endedAt: data.endedAt.present ? data.endedAt.value : this.endedAt,
      summary: data.summary.present ? data.summary.value : this.summary,
      segmentCount: data.segmentCount.present
          ? data.segmentCount.value
          : this.segmentCount,
      actionCount: data.actionCount.present
          ? data.actionCount.value
          : this.actionCount,
      decisionCount: data.decisionCount.present
          ? data.decisionCount.value
          : this.decisionCount,
      isImportant: data.isImportant.present
          ? data.isImportant.value
          : this.isImportant,
      createdAt: data.createdAt.present ? data.createdAt.value : this.createdAt,
      updatedAt: data.updatedAt.present ? data.updatedAt.value : this.updatedAt,
    );
  }

  @override
  String toString() {
    return (StringBuffer('Meeting(')
          ..write('meetingId: $meetingId, ')
          ..write('calendarEventId: $calendarEventId, ')
          ..write('title: $title, ')
          ..write('status: $status, ')
          ..write('recordType: $recordType, ')
          ..write('participantName: $participantName, ')
          ..write('startedAt: $startedAt, ')
          ..write('endedAt: $endedAt, ')
          ..write('summary: $summary, ')
          ..write('segmentCount: $segmentCount, ')
          ..write('actionCount: $actionCount, ')
          ..write('decisionCount: $decisionCount, ')
          ..write('isImportant: $isImportant, ')
          ..write('createdAt: $createdAt, ')
          ..write('updatedAt: $updatedAt')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(
    meetingId,
    calendarEventId,
    title,
    status,
    recordType,
    participantName,
    startedAt,
    endedAt,
    summary,
    segmentCount,
    actionCount,
    decisionCount,
    isImportant,
    createdAt,
    updatedAt,
  );
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is Meeting &&
          other.meetingId == this.meetingId &&
          other.calendarEventId == this.calendarEventId &&
          other.title == this.title &&
          other.status == this.status &&
          other.recordType == this.recordType &&
          other.participantName == this.participantName &&
          other.startedAt == this.startedAt &&
          other.endedAt == this.endedAt &&
          other.summary == this.summary &&
          other.segmentCount == this.segmentCount &&
          other.actionCount == this.actionCount &&
          other.decisionCount == this.decisionCount &&
          other.isImportant == this.isImportant &&
          other.createdAt == this.createdAt &&
          other.updatedAt == this.updatedAt);
}

class MeetingsCompanion extends UpdateCompanion<Meeting> {
  final Value<String> meetingId;
  final Value<String?> calendarEventId;
  final Value<String> title;
  final Value<String> status;
  final Value<String> recordType;
  final Value<String?> participantName;
  final Value<DateTime?> startedAt;
  final Value<DateTime?> endedAt;
  final Value<String?> summary;
  final Value<int> segmentCount;
  final Value<int> actionCount;
  final Value<int> decisionCount;
  final Value<bool> isImportant;
  final Value<DateTime> createdAt;
  final Value<DateTime> updatedAt;
  final Value<int> rowid;
  const MeetingsCompanion({
    this.meetingId = const Value.absent(),
    this.calendarEventId = const Value.absent(),
    this.title = const Value.absent(),
    this.status = const Value.absent(),
    this.recordType = const Value.absent(),
    this.participantName = const Value.absent(),
    this.startedAt = const Value.absent(),
    this.endedAt = const Value.absent(),
    this.summary = const Value.absent(),
    this.segmentCount = const Value.absent(),
    this.actionCount = const Value.absent(),
    this.decisionCount = const Value.absent(),
    this.isImportant = const Value.absent(),
    this.createdAt = const Value.absent(),
    this.updatedAt = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  MeetingsCompanion.insert({
    required String meetingId,
    this.calendarEventId = const Value.absent(),
    this.title = const Value.absent(),
    this.status = const Value.absent(),
    this.recordType = const Value.absent(),
    this.participantName = const Value.absent(),
    this.startedAt = const Value.absent(),
    this.endedAt = const Value.absent(),
    this.summary = const Value.absent(),
    this.segmentCount = const Value.absent(),
    this.actionCount = const Value.absent(),
    this.decisionCount = const Value.absent(),
    this.isImportant = const Value.absent(),
    this.createdAt = const Value.absent(),
    this.updatedAt = const Value.absent(),
    this.rowid = const Value.absent(),
  }) : meetingId = Value(meetingId);
  static Insertable<Meeting> custom({
    Expression<String>? meetingId,
    Expression<String>? calendarEventId,
    Expression<String>? title,
    Expression<String>? status,
    Expression<String>? recordType,
    Expression<String>? participantName,
    Expression<DateTime>? startedAt,
    Expression<DateTime>? endedAt,
    Expression<String>? summary,
    Expression<int>? segmentCount,
    Expression<int>? actionCount,
    Expression<int>? decisionCount,
    Expression<bool>? isImportant,
    Expression<DateTime>? createdAt,
    Expression<DateTime>? updatedAt,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (meetingId != null) 'meeting_id': meetingId,
      if (calendarEventId != null) 'calendar_event_id': calendarEventId,
      if (title != null) 'title': title,
      if (status != null) 'status': status,
      if (recordType != null) 'record_type': recordType,
      if (participantName != null) 'participant_name': participantName,
      if (startedAt != null) 'started_at': startedAt,
      if (endedAt != null) 'ended_at': endedAt,
      if (summary != null) 'summary': summary,
      if (segmentCount != null) 'segment_count': segmentCount,
      if (actionCount != null) 'action_count': actionCount,
      if (decisionCount != null) 'decision_count': decisionCount,
      if (isImportant != null) 'is_important': isImportant,
      if (createdAt != null) 'created_at': createdAt,
      if (updatedAt != null) 'updated_at': updatedAt,
      if (rowid != null) 'rowid': rowid,
    });
  }

  MeetingsCompanion copyWith({
    Value<String>? meetingId,
    Value<String?>? calendarEventId,
    Value<String>? title,
    Value<String>? status,
    Value<String>? recordType,
    Value<String?>? participantName,
    Value<DateTime?>? startedAt,
    Value<DateTime?>? endedAt,
    Value<String?>? summary,
    Value<int>? segmentCount,
    Value<int>? actionCount,
    Value<int>? decisionCount,
    Value<bool>? isImportant,
    Value<DateTime>? createdAt,
    Value<DateTime>? updatedAt,
    Value<int>? rowid,
  }) {
    return MeetingsCompanion(
      meetingId: meetingId ?? this.meetingId,
      calendarEventId: calendarEventId ?? this.calendarEventId,
      title: title ?? this.title,
      status: status ?? this.status,
      recordType: recordType ?? this.recordType,
      participantName: participantName ?? this.participantName,
      startedAt: startedAt ?? this.startedAt,
      endedAt: endedAt ?? this.endedAt,
      summary: summary ?? this.summary,
      segmentCount: segmentCount ?? this.segmentCount,
      actionCount: actionCount ?? this.actionCount,
      decisionCount: decisionCount ?? this.decisionCount,
      isImportant: isImportant ?? this.isImportant,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (meetingId.present) {
      map['meeting_id'] = Variable<String>(meetingId.value);
    }
    if (calendarEventId.present) {
      map['calendar_event_id'] = Variable<String>(calendarEventId.value);
    }
    if (title.present) {
      map['title'] = Variable<String>(title.value);
    }
    if (status.present) {
      map['status'] = Variable<String>(status.value);
    }
    if (recordType.present) {
      map['record_type'] = Variable<String>(recordType.value);
    }
    if (participantName.present) {
      map['participant_name'] = Variable<String>(participantName.value);
    }
    if (startedAt.present) {
      map['started_at'] = Variable<DateTime>(startedAt.value);
    }
    if (endedAt.present) {
      map['ended_at'] = Variable<DateTime>(endedAt.value);
    }
    if (summary.present) {
      map['summary'] = Variable<String>(summary.value);
    }
    if (segmentCount.present) {
      map['segment_count'] = Variable<int>(segmentCount.value);
    }
    if (actionCount.present) {
      map['action_count'] = Variable<int>(actionCount.value);
    }
    if (decisionCount.present) {
      map['decision_count'] = Variable<int>(decisionCount.value);
    }
    if (isImportant.present) {
      map['is_important'] = Variable<bool>(isImportant.value);
    }
    if (createdAt.present) {
      map['created_at'] = Variable<DateTime>(createdAt.value);
    }
    if (updatedAt.present) {
      map['updated_at'] = Variable<DateTime>(updatedAt.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('MeetingsCompanion(')
          ..write('meetingId: $meetingId, ')
          ..write('calendarEventId: $calendarEventId, ')
          ..write('title: $title, ')
          ..write('status: $status, ')
          ..write('recordType: $recordType, ')
          ..write('participantName: $participantName, ')
          ..write('startedAt: $startedAt, ')
          ..write('endedAt: $endedAt, ')
          ..write('summary: $summary, ')
          ..write('segmentCount: $segmentCount, ')
          ..write('actionCount: $actionCount, ')
          ..write('decisionCount: $decisionCount, ')
          ..write('isImportant: $isImportant, ')
          ..write('createdAt: $createdAt, ')
          ..write('updatedAt: $updatedAt, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $TranscriptSegmentsTable extends TranscriptSegments
    with TableInfo<$TranscriptSegmentsTable, TranscriptSegment> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $TranscriptSegmentsTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _segmentIdMeta = const VerificationMeta(
    'segmentId',
  );
  @override
  late final GeneratedColumn<String> segmentId = GeneratedColumn<String>(
    'segment_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _meetingIdMeta = const VerificationMeta(
    'meetingId',
  );
  @override
  late final GeneratedColumn<String> meetingId = GeneratedColumn<String>(
    'meeting_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _speakerMeta = const VerificationMeta(
    'speaker',
  );
  @override
  late final GeneratedColumn<String> speaker = GeneratedColumn<String>(
    'speaker',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
    defaultValue: const Constant('unknown'),
  );
  static const VerificationMeta _timestampMeta = const VerificationMeta(
    'timestamp',
  );
  @override
  late final GeneratedColumn<DateTime> timestamp = GeneratedColumn<DateTime>(
    'timestamp',
    aliasedName,
    true,
    type: DriftSqlType.dateTime,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _contentMeta = const VerificationMeta(
    'content',
  );
  @override
  late final GeneratedColumn<String> content = GeneratedColumn<String>(
    'content',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _confidenceMeta = const VerificationMeta(
    'confidence',
  );
  @override
  late final GeneratedColumn<double> confidence = GeneratedColumn<double>(
    'confidence',
    aliasedName,
    true,
    type: DriftSqlType.double,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _sourceMeta = const VerificationMeta('source');
  @override
  late final GeneratedColumn<String> source = GeneratedColumn<String>(
    'source',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
    defaultValue: const Constant('text_input'),
  );
  static const VerificationMeta _createdAtMeta = const VerificationMeta(
    'createdAt',
  );
  @override
  late final GeneratedColumn<DateTime> createdAt = GeneratedColumn<DateTime>(
    'created_at',
    aliasedName,
    false,
    type: DriftSqlType.dateTime,
    requiredDuringInsert: false,
    defaultValue: currentDateAndTime,
  );
  @override
  List<GeneratedColumn> get $columns => [
    segmentId,
    meetingId,
    speaker,
    timestamp,
    content,
    confidence,
    source,
    createdAt,
  ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'transcript_segments';
  @override
  VerificationContext validateIntegrity(
    Insertable<TranscriptSegment> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('segment_id')) {
      context.handle(
        _segmentIdMeta,
        segmentId.isAcceptableOrUnknown(data['segment_id']!, _segmentIdMeta),
      );
    } else if (isInserting) {
      context.missing(_segmentIdMeta);
    }
    if (data.containsKey('meeting_id')) {
      context.handle(
        _meetingIdMeta,
        meetingId.isAcceptableOrUnknown(data['meeting_id']!, _meetingIdMeta),
      );
    } else if (isInserting) {
      context.missing(_meetingIdMeta);
    }
    if (data.containsKey('speaker')) {
      context.handle(
        _speakerMeta,
        speaker.isAcceptableOrUnknown(data['speaker']!, _speakerMeta),
      );
    }
    if (data.containsKey('timestamp')) {
      context.handle(
        _timestampMeta,
        timestamp.isAcceptableOrUnknown(data['timestamp']!, _timestampMeta),
      );
    }
    if (data.containsKey('content')) {
      context.handle(
        _contentMeta,
        content.isAcceptableOrUnknown(data['content']!, _contentMeta),
      );
    } else if (isInserting) {
      context.missing(_contentMeta);
    }
    if (data.containsKey('confidence')) {
      context.handle(
        _confidenceMeta,
        confidence.isAcceptableOrUnknown(data['confidence']!, _confidenceMeta),
      );
    }
    if (data.containsKey('source')) {
      context.handle(
        _sourceMeta,
        source.isAcceptableOrUnknown(data['source']!, _sourceMeta),
      );
    }
    if (data.containsKey('created_at')) {
      context.handle(
        _createdAtMeta,
        createdAt.isAcceptableOrUnknown(data['created_at']!, _createdAtMeta),
      );
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {segmentId};
  @override
  TranscriptSegment map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return TranscriptSegment(
      segmentId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}segment_id'],
      )!,
      meetingId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}meeting_id'],
      )!,
      speaker: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}speaker'],
      )!,
      timestamp: attachedDatabase.typeMapping.read(
        DriftSqlType.dateTime,
        data['${effectivePrefix}timestamp'],
      ),
      content: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}content'],
      )!,
      confidence: attachedDatabase.typeMapping.read(
        DriftSqlType.double,
        data['${effectivePrefix}confidence'],
      ),
      source: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}source'],
      )!,
      createdAt: attachedDatabase.typeMapping.read(
        DriftSqlType.dateTime,
        data['${effectivePrefix}created_at'],
      )!,
    );
  }

  @override
  $TranscriptSegmentsTable createAlias(String alias) {
    return $TranscriptSegmentsTable(attachedDatabase, alias);
  }
}

class TranscriptSegment extends DataClass
    implements Insertable<TranscriptSegment> {
  final String segmentId;
  final String meetingId;
  final String speaker;
  final DateTime? timestamp;
  final String content;
  final double? confidence;
  final String source;
  final DateTime createdAt;
  const TranscriptSegment({
    required this.segmentId,
    required this.meetingId,
    required this.speaker,
    this.timestamp,
    required this.content,
    this.confidence,
    required this.source,
    required this.createdAt,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['segment_id'] = Variable<String>(segmentId);
    map['meeting_id'] = Variable<String>(meetingId);
    map['speaker'] = Variable<String>(speaker);
    if (!nullToAbsent || timestamp != null) {
      map['timestamp'] = Variable<DateTime>(timestamp);
    }
    map['content'] = Variable<String>(content);
    if (!nullToAbsent || confidence != null) {
      map['confidence'] = Variable<double>(confidence);
    }
    map['source'] = Variable<String>(source);
    map['created_at'] = Variable<DateTime>(createdAt);
    return map;
  }

  TranscriptSegmentsCompanion toCompanion(bool nullToAbsent) {
    return TranscriptSegmentsCompanion(
      segmentId: Value(segmentId),
      meetingId: Value(meetingId),
      speaker: Value(speaker),
      timestamp: timestamp == null && nullToAbsent
          ? const Value.absent()
          : Value(timestamp),
      content: Value(content),
      confidence: confidence == null && nullToAbsent
          ? const Value.absent()
          : Value(confidence),
      source: Value(source),
      createdAt: Value(createdAt),
    );
  }

  factory TranscriptSegment.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return TranscriptSegment(
      segmentId: serializer.fromJson<String>(json['segmentId']),
      meetingId: serializer.fromJson<String>(json['meetingId']),
      speaker: serializer.fromJson<String>(json['speaker']),
      timestamp: serializer.fromJson<DateTime?>(json['timestamp']),
      content: serializer.fromJson<String>(json['content']),
      confidence: serializer.fromJson<double?>(json['confidence']),
      source: serializer.fromJson<String>(json['source']),
      createdAt: serializer.fromJson<DateTime>(json['createdAt']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'segmentId': serializer.toJson<String>(segmentId),
      'meetingId': serializer.toJson<String>(meetingId),
      'speaker': serializer.toJson<String>(speaker),
      'timestamp': serializer.toJson<DateTime?>(timestamp),
      'content': serializer.toJson<String>(content),
      'confidence': serializer.toJson<double?>(confidence),
      'source': serializer.toJson<String>(source),
      'createdAt': serializer.toJson<DateTime>(createdAt),
    };
  }

  TranscriptSegment copyWith({
    String? segmentId,
    String? meetingId,
    String? speaker,
    Value<DateTime?> timestamp = const Value.absent(),
    String? content,
    Value<double?> confidence = const Value.absent(),
    String? source,
    DateTime? createdAt,
  }) => TranscriptSegment(
    segmentId: segmentId ?? this.segmentId,
    meetingId: meetingId ?? this.meetingId,
    speaker: speaker ?? this.speaker,
    timestamp: timestamp.present ? timestamp.value : this.timestamp,
    content: content ?? this.content,
    confidence: confidence.present ? confidence.value : this.confidence,
    source: source ?? this.source,
    createdAt: createdAt ?? this.createdAt,
  );
  TranscriptSegment copyWithCompanion(TranscriptSegmentsCompanion data) {
    return TranscriptSegment(
      segmentId: data.segmentId.present ? data.segmentId.value : this.segmentId,
      meetingId: data.meetingId.present ? data.meetingId.value : this.meetingId,
      speaker: data.speaker.present ? data.speaker.value : this.speaker,
      timestamp: data.timestamp.present ? data.timestamp.value : this.timestamp,
      content: data.content.present ? data.content.value : this.content,
      confidence: data.confidence.present
          ? data.confidence.value
          : this.confidence,
      source: data.source.present ? data.source.value : this.source,
      createdAt: data.createdAt.present ? data.createdAt.value : this.createdAt,
    );
  }

  @override
  String toString() {
    return (StringBuffer('TranscriptSegment(')
          ..write('segmentId: $segmentId, ')
          ..write('meetingId: $meetingId, ')
          ..write('speaker: $speaker, ')
          ..write('timestamp: $timestamp, ')
          ..write('content: $content, ')
          ..write('confidence: $confidence, ')
          ..write('source: $source, ')
          ..write('createdAt: $createdAt')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(
    segmentId,
    meetingId,
    speaker,
    timestamp,
    content,
    confidence,
    source,
    createdAt,
  );
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is TranscriptSegment &&
          other.segmentId == this.segmentId &&
          other.meetingId == this.meetingId &&
          other.speaker == this.speaker &&
          other.timestamp == this.timestamp &&
          other.content == this.content &&
          other.confidence == this.confidence &&
          other.source == this.source &&
          other.createdAt == this.createdAt);
}

class TranscriptSegmentsCompanion extends UpdateCompanion<TranscriptSegment> {
  final Value<String> segmentId;
  final Value<String> meetingId;
  final Value<String> speaker;
  final Value<DateTime?> timestamp;
  final Value<String> content;
  final Value<double?> confidence;
  final Value<String> source;
  final Value<DateTime> createdAt;
  final Value<int> rowid;
  const TranscriptSegmentsCompanion({
    this.segmentId = const Value.absent(),
    this.meetingId = const Value.absent(),
    this.speaker = const Value.absent(),
    this.timestamp = const Value.absent(),
    this.content = const Value.absent(),
    this.confidence = const Value.absent(),
    this.source = const Value.absent(),
    this.createdAt = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  TranscriptSegmentsCompanion.insert({
    required String segmentId,
    required String meetingId,
    this.speaker = const Value.absent(),
    this.timestamp = const Value.absent(),
    required String content,
    this.confidence = const Value.absent(),
    this.source = const Value.absent(),
    this.createdAt = const Value.absent(),
    this.rowid = const Value.absent(),
  }) : segmentId = Value(segmentId),
       meetingId = Value(meetingId),
       content = Value(content);
  static Insertable<TranscriptSegment> custom({
    Expression<String>? segmentId,
    Expression<String>? meetingId,
    Expression<String>? speaker,
    Expression<DateTime>? timestamp,
    Expression<String>? content,
    Expression<double>? confidence,
    Expression<String>? source,
    Expression<DateTime>? createdAt,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (segmentId != null) 'segment_id': segmentId,
      if (meetingId != null) 'meeting_id': meetingId,
      if (speaker != null) 'speaker': speaker,
      if (timestamp != null) 'timestamp': timestamp,
      if (content != null) 'content': content,
      if (confidence != null) 'confidence': confidence,
      if (source != null) 'source': source,
      if (createdAt != null) 'created_at': createdAt,
      if (rowid != null) 'rowid': rowid,
    });
  }

  TranscriptSegmentsCompanion copyWith({
    Value<String>? segmentId,
    Value<String>? meetingId,
    Value<String>? speaker,
    Value<DateTime?>? timestamp,
    Value<String>? content,
    Value<double?>? confidence,
    Value<String>? source,
    Value<DateTime>? createdAt,
    Value<int>? rowid,
  }) {
    return TranscriptSegmentsCompanion(
      segmentId: segmentId ?? this.segmentId,
      meetingId: meetingId ?? this.meetingId,
      speaker: speaker ?? this.speaker,
      timestamp: timestamp ?? this.timestamp,
      content: content ?? this.content,
      confidence: confidence ?? this.confidence,
      source: source ?? this.source,
      createdAt: createdAt ?? this.createdAt,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (segmentId.present) {
      map['segment_id'] = Variable<String>(segmentId.value);
    }
    if (meetingId.present) {
      map['meeting_id'] = Variable<String>(meetingId.value);
    }
    if (speaker.present) {
      map['speaker'] = Variable<String>(speaker.value);
    }
    if (timestamp.present) {
      map['timestamp'] = Variable<DateTime>(timestamp.value);
    }
    if (content.present) {
      map['content'] = Variable<String>(content.value);
    }
    if (confidence.present) {
      map['confidence'] = Variable<double>(confidence.value);
    }
    if (source.present) {
      map['source'] = Variable<String>(source.value);
    }
    if (createdAt.present) {
      map['created_at'] = Variable<DateTime>(createdAt.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('TranscriptSegmentsCompanion(')
          ..write('segmentId: $segmentId, ')
          ..write('meetingId: $meetingId, ')
          ..write('speaker: $speaker, ')
          ..write('timestamp: $timestamp, ')
          ..write('content: $content, ')
          ..write('confidence: $confidence, ')
          ..write('source: $source, ')
          ..write('createdAt: $createdAt, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $ExtractedItemsTable extends ExtractedItems
    with TableInfo<$ExtractedItemsTable, ExtractedItem> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $ExtractedItemsTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _itemIdMeta = const VerificationMeta('itemId');
  @override
  late final GeneratedColumn<String> itemId = GeneratedColumn<String>(
    'item_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _meetingIdMeta = const VerificationMeta(
    'meetingId',
  );
  @override
  late final GeneratedColumn<String> meetingId = GeneratedColumn<String>(
    'meeting_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _itemTypeMeta = const VerificationMeta(
    'itemType',
  );
  @override
  late final GeneratedColumn<String> itemType = GeneratedColumn<String>(
    'item_type',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _statusMeta = const VerificationMeta('status');
  @override
  late final GeneratedColumn<String> status = GeneratedColumn<String>(
    'status',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
    defaultValue: const Constant('draft'),
  );
  static const VerificationMeta _contentMeta = const VerificationMeta(
    'content',
  );
  @override
  late final GeneratedColumn<String> content = GeneratedColumn<String>(
    'content',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _confidenceMeta = const VerificationMeta(
    'confidence',
  );
  @override
  late final GeneratedColumn<double> confidence = GeneratedColumn<double>(
    'confidence',
    aliasedName,
    true,
    type: DriftSqlType.double,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _ownerLabelMeta = const VerificationMeta(
    'ownerLabel',
  );
  @override
  late final GeneratedColumn<String> ownerLabel = GeneratedColumn<String>(
    'owner_label',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _dueDateMeta = const VerificationMeta(
    'dueDate',
  );
  @override
  late final GeneratedColumn<String> dueDate = GeneratedColumn<String>(
    'due_date',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _dueTimeMeta = const VerificationMeta(
    'dueTime',
  );
  @override
  late final GeneratedColumn<String> dueTime = GeneratedColumn<String>(
    'due_time',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _scheduledCalendarEventIdMeta =
      const VerificationMeta('scheduledCalendarEventId');
  @override
  late final GeneratedColumn<String> scheduledCalendarEventId =
      GeneratedColumn<String>(
        'scheduled_calendar_event_id',
        aliasedName,
        true,
        type: DriftSqlType.string,
        requiredDuringInsert: false,
      );
  static const VerificationMeta _confirmedAtMeta = const VerificationMeta(
    'confirmedAt',
  );
  @override
  late final GeneratedColumn<DateTime> confirmedAt = GeneratedColumn<DateTime>(
    'confirmed_at',
    aliasedName,
    true,
    type: DriftSqlType.dateTime,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _scheduledAtMeta = const VerificationMeta(
    'scheduledAt',
  );
  @override
  late final GeneratedColumn<DateTime> scheduledAt = GeneratedColumn<DateTime>(
    'scheduled_at',
    aliasedName,
    true,
    type: DriftSqlType.dateTime,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _completedAtMeta = const VerificationMeta(
    'completedAt',
  );
  @override
  late final GeneratedColumn<DateTime> completedAt = GeneratedColumn<DateTime>(
    'completed_at',
    aliasedName,
    true,
    type: DriftSqlType.dateTime,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _archivedAtMeta = const VerificationMeta(
    'archivedAt',
  );
  @override
  late final GeneratedColumn<DateTime> archivedAt = GeneratedColumn<DateTime>(
    'archived_at',
    aliasedName,
    true,
    type: DriftSqlType.dateTime,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _createdAtMeta = const VerificationMeta(
    'createdAt',
  );
  @override
  late final GeneratedColumn<DateTime> createdAt = GeneratedColumn<DateTime>(
    'created_at',
    aliasedName,
    false,
    type: DriftSqlType.dateTime,
    requiredDuringInsert: false,
    defaultValue: currentDateAndTime,
  );
  static const VerificationMeta _updatedAtMeta = const VerificationMeta(
    'updatedAt',
  );
  @override
  late final GeneratedColumn<DateTime> updatedAt = GeneratedColumn<DateTime>(
    'updated_at',
    aliasedName,
    false,
    type: DriftSqlType.dateTime,
    requiredDuringInsert: false,
    defaultValue: currentDateAndTime,
  );
  @override
  List<GeneratedColumn> get $columns => [
    itemId,
    meetingId,
    itemType,
    status,
    content,
    confidence,
    ownerLabel,
    dueDate,
    dueTime,
    scheduledCalendarEventId,
    confirmedAt,
    scheduledAt,
    completedAt,
    archivedAt,
    createdAt,
    updatedAt,
  ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'extracted_items';
  @override
  VerificationContext validateIntegrity(
    Insertable<ExtractedItem> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('item_id')) {
      context.handle(
        _itemIdMeta,
        itemId.isAcceptableOrUnknown(data['item_id']!, _itemIdMeta),
      );
    } else if (isInserting) {
      context.missing(_itemIdMeta);
    }
    if (data.containsKey('meeting_id')) {
      context.handle(
        _meetingIdMeta,
        meetingId.isAcceptableOrUnknown(data['meeting_id']!, _meetingIdMeta),
      );
    } else if (isInserting) {
      context.missing(_meetingIdMeta);
    }
    if (data.containsKey('item_type')) {
      context.handle(
        _itemTypeMeta,
        itemType.isAcceptableOrUnknown(data['item_type']!, _itemTypeMeta),
      );
    } else if (isInserting) {
      context.missing(_itemTypeMeta);
    }
    if (data.containsKey('status')) {
      context.handle(
        _statusMeta,
        status.isAcceptableOrUnknown(data['status']!, _statusMeta),
      );
    }
    if (data.containsKey('content')) {
      context.handle(
        _contentMeta,
        content.isAcceptableOrUnknown(data['content']!, _contentMeta),
      );
    } else if (isInserting) {
      context.missing(_contentMeta);
    }
    if (data.containsKey('confidence')) {
      context.handle(
        _confidenceMeta,
        confidence.isAcceptableOrUnknown(data['confidence']!, _confidenceMeta),
      );
    }
    if (data.containsKey('owner_label')) {
      context.handle(
        _ownerLabelMeta,
        ownerLabel.isAcceptableOrUnknown(data['owner_label']!, _ownerLabelMeta),
      );
    }
    if (data.containsKey('due_date')) {
      context.handle(
        _dueDateMeta,
        dueDate.isAcceptableOrUnknown(data['due_date']!, _dueDateMeta),
      );
    }
    if (data.containsKey('due_time')) {
      context.handle(
        _dueTimeMeta,
        dueTime.isAcceptableOrUnknown(data['due_time']!, _dueTimeMeta),
      );
    }
    if (data.containsKey('scheduled_calendar_event_id')) {
      context.handle(
        _scheduledCalendarEventIdMeta,
        scheduledCalendarEventId.isAcceptableOrUnknown(
          data['scheduled_calendar_event_id']!,
          _scheduledCalendarEventIdMeta,
        ),
      );
    }
    if (data.containsKey('confirmed_at')) {
      context.handle(
        _confirmedAtMeta,
        confirmedAt.isAcceptableOrUnknown(
          data['confirmed_at']!,
          _confirmedAtMeta,
        ),
      );
    }
    if (data.containsKey('scheduled_at')) {
      context.handle(
        _scheduledAtMeta,
        scheduledAt.isAcceptableOrUnknown(
          data['scheduled_at']!,
          _scheduledAtMeta,
        ),
      );
    }
    if (data.containsKey('completed_at')) {
      context.handle(
        _completedAtMeta,
        completedAt.isAcceptableOrUnknown(
          data['completed_at']!,
          _completedAtMeta,
        ),
      );
    }
    if (data.containsKey('archived_at')) {
      context.handle(
        _archivedAtMeta,
        archivedAt.isAcceptableOrUnknown(data['archived_at']!, _archivedAtMeta),
      );
    }
    if (data.containsKey('created_at')) {
      context.handle(
        _createdAtMeta,
        createdAt.isAcceptableOrUnknown(data['created_at']!, _createdAtMeta),
      );
    }
    if (data.containsKey('updated_at')) {
      context.handle(
        _updatedAtMeta,
        updatedAt.isAcceptableOrUnknown(data['updated_at']!, _updatedAtMeta),
      );
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {itemId};
  @override
  ExtractedItem map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return ExtractedItem(
      itemId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}item_id'],
      )!,
      meetingId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}meeting_id'],
      )!,
      itemType: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}item_type'],
      )!,
      status: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}status'],
      )!,
      content: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}content'],
      )!,
      confidence: attachedDatabase.typeMapping.read(
        DriftSqlType.double,
        data['${effectivePrefix}confidence'],
      ),
      ownerLabel: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}owner_label'],
      ),
      dueDate: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}due_date'],
      ),
      dueTime: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}due_time'],
      ),
      scheduledCalendarEventId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}scheduled_calendar_event_id'],
      ),
      confirmedAt: attachedDatabase.typeMapping.read(
        DriftSqlType.dateTime,
        data['${effectivePrefix}confirmed_at'],
      ),
      scheduledAt: attachedDatabase.typeMapping.read(
        DriftSqlType.dateTime,
        data['${effectivePrefix}scheduled_at'],
      ),
      completedAt: attachedDatabase.typeMapping.read(
        DriftSqlType.dateTime,
        data['${effectivePrefix}completed_at'],
      ),
      archivedAt: attachedDatabase.typeMapping.read(
        DriftSqlType.dateTime,
        data['${effectivePrefix}archived_at'],
      ),
      createdAt: attachedDatabase.typeMapping.read(
        DriftSqlType.dateTime,
        data['${effectivePrefix}created_at'],
      )!,
      updatedAt: attachedDatabase.typeMapping.read(
        DriftSqlType.dateTime,
        data['${effectivePrefix}updated_at'],
      )!,
    );
  }

  @override
  $ExtractedItemsTable createAlias(String alias) {
    return $ExtractedItemsTable(attachedDatabase, alias);
  }
}

class ExtractedItem extends DataClass implements Insertable<ExtractedItem> {
  final String itemId;
  final String meetingId;
  final String itemType;
  final String status;
  final String content;
  final double? confidence;
  final String? ownerLabel;
  final String? dueDate;
  final String? dueTime;
  final String? scheduledCalendarEventId;
  final DateTime? confirmedAt;
  final DateTime? scheduledAt;
  final DateTime? completedAt;
  final DateTime? archivedAt;
  final DateTime createdAt;
  final DateTime updatedAt;
  const ExtractedItem({
    required this.itemId,
    required this.meetingId,
    required this.itemType,
    required this.status,
    required this.content,
    this.confidence,
    this.ownerLabel,
    this.dueDate,
    this.dueTime,
    this.scheduledCalendarEventId,
    this.confirmedAt,
    this.scheduledAt,
    this.completedAt,
    this.archivedAt,
    required this.createdAt,
    required this.updatedAt,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['item_id'] = Variable<String>(itemId);
    map['meeting_id'] = Variable<String>(meetingId);
    map['item_type'] = Variable<String>(itemType);
    map['status'] = Variable<String>(status);
    map['content'] = Variable<String>(content);
    if (!nullToAbsent || confidence != null) {
      map['confidence'] = Variable<double>(confidence);
    }
    if (!nullToAbsent || ownerLabel != null) {
      map['owner_label'] = Variable<String>(ownerLabel);
    }
    if (!nullToAbsent || dueDate != null) {
      map['due_date'] = Variable<String>(dueDate);
    }
    if (!nullToAbsent || dueTime != null) {
      map['due_time'] = Variable<String>(dueTime);
    }
    if (!nullToAbsent || scheduledCalendarEventId != null) {
      map['scheduled_calendar_event_id'] = Variable<String>(
        scheduledCalendarEventId,
      );
    }
    if (!nullToAbsent || confirmedAt != null) {
      map['confirmed_at'] = Variable<DateTime>(confirmedAt);
    }
    if (!nullToAbsent || scheduledAt != null) {
      map['scheduled_at'] = Variable<DateTime>(scheduledAt);
    }
    if (!nullToAbsent || completedAt != null) {
      map['completed_at'] = Variable<DateTime>(completedAt);
    }
    if (!nullToAbsent || archivedAt != null) {
      map['archived_at'] = Variable<DateTime>(archivedAt);
    }
    map['created_at'] = Variable<DateTime>(createdAt);
    map['updated_at'] = Variable<DateTime>(updatedAt);
    return map;
  }

  ExtractedItemsCompanion toCompanion(bool nullToAbsent) {
    return ExtractedItemsCompanion(
      itemId: Value(itemId),
      meetingId: Value(meetingId),
      itemType: Value(itemType),
      status: Value(status),
      content: Value(content),
      confidence: confidence == null && nullToAbsent
          ? const Value.absent()
          : Value(confidence),
      ownerLabel: ownerLabel == null && nullToAbsent
          ? const Value.absent()
          : Value(ownerLabel),
      dueDate: dueDate == null && nullToAbsent
          ? const Value.absent()
          : Value(dueDate),
      dueTime: dueTime == null && nullToAbsent
          ? const Value.absent()
          : Value(dueTime),
      scheduledCalendarEventId: scheduledCalendarEventId == null && nullToAbsent
          ? const Value.absent()
          : Value(scheduledCalendarEventId),
      confirmedAt: confirmedAt == null && nullToAbsent
          ? const Value.absent()
          : Value(confirmedAt),
      scheduledAt: scheduledAt == null && nullToAbsent
          ? const Value.absent()
          : Value(scheduledAt),
      completedAt: completedAt == null && nullToAbsent
          ? const Value.absent()
          : Value(completedAt),
      archivedAt: archivedAt == null && nullToAbsent
          ? const Value.absent()
          : Value(archivedAt),
      createdAt: Value(createdAt),
      updatedAt: Value(updatedAt),
    );
  }

  factory ExtractedItem.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return ExtractedItem(
      itemId: serializer.fromJson<String>(json['itemId']),
      meetingId: serializer.fromJson<String>(json['meetingId']),
      itemType: serializer.fromJson<String>(json['itemType']),
      status: serializer.fromJson<String>(json['status']),
      content: serializer.fromJson<String>(json['content']),
      confidence: serializer.fromJson<double?>(json['confidence']),
      ownerLabel: serializer.fromJson<String?>(json['ownerLabel']),
      dueDate: serializer.fromJson<String?>(json['dueDate']),
      dueTime: serializer.fromJson<String?>(json['dueTime']),
      scheduledCalendarEventId: serializer.fromJson<String?>(
        json['scheduledCalendarEventId'],
      ),
      confirmedAt: serializer.fromJson<DateTime?>(json['confirmedAt']),
      scheduledAt: serializer.fromJson<DateTime?>(json['scheduledAt']),
      completedAt: serializer.fromJson<DateTime?>(json['completedAt']),
      archivedAt: serializer.fromJson<DateTime?>(json['archivedAt']),
      createdAt: serializer.fromJson<DateTime>(json['createdAt']),
      updatedAt: serializer.fromJson<DateTime>(json['updatedAt']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'itemId': serializer.toJson<String>(itemId),
      'meetingId': serializer.toJson<String>(meetingId),
      'itemType': serializer.toJson<String>(itemType),
      'status': serializer.toJson<String>(status),
      'content': serializer.toJson<String>(content),
      'confidence': serializer.toJson<double?>(confidence),
      'ownerLabel': serializer.toJson<String?>(ownerLabel),
      'dueDate': serializer.toJson<String?>(dueDate),
      'dueTime': serializer.toJson<String?>(dueTime),
      'scheduledCalendarEventId': serializer.toJson<String?>(
        scheduledCalendarEventId,
      ),
      'confirmedAt': serializer.toJson<DateTime?>(confirmedAt),
      'scheduledAt': serializer.toJson<DateTime?>(scheduledAt),
      'completedAt': serializer.toJson<DateTime?>(completedAt),
      'archivedAt': serializer.toJson<DateTime?>(archivedAt),
      'createdAt': serializer.toJson<DateTime>(createdAt),
      'updatedAt': serializer.toJson<DateTime>(updatedAt),
    };
  }

  ExtractedItem copyWith({
    String? itemId,
    String? meetingId,
    String? itemType,
    String? status,
    String? content,
    Value<double?> confidence = const Value.absent(),
    Value<String?> ownerLabel = const Value.absent(),
    Value<String?> dueDate = const Value.absent(),
    Value<String?> dueTime = const Value.absent(),
    Value<String?> scheduledCalendarEventId = const Value.absent(),
    Value<DateTime?> confirmedAt = const Value.absent(),
    Value<DateTime?> scheduledAt = const Value.absent(),
    Value<DateTime?> completedAt = const Value.absent(),
    Value<DateTime?> archivedAt = const Value.absent(),
    DateTime? createdAt,
    DateTime? updatedAt,
  }) => ExtractedItem(
    itemId: itemId ?? this.itemId,
    meetingId: meetingId ?? this.meetingId,
    itemType: itemType ?? this.itemType,
    status: status ?? this.status,
    content: content ?? this.content,
    confidence: confidence.present ? confidence.value : this.confidence,
    ownerLabel: ownerLabel.present ? ownerLabel.value : this.ownerLabel,
    dueDate: dueDate.present ? dueDate.value : this.dueDate,
    dueTime: dueTime.present ? dueTime.value : this.dueTime,
    scheduledCalendarEventId: scheduledCalendarEventId.present
        ? scheduledCalendarEventId.value
        : this.scheduledCalendarEventId,
    confirmedAt: confirmedAt.present ? confirmedAt.value : this.confirmedAt,
    scheduledAt: scheduledAt.present ? scheduledAt.value : this.scheduledAt,
    completedAt: completedAt.present ? completedAt.value : this.completedAt,
    archivedAt: archivedAt.present ? archivedAt.value : this.archivedAt,
    createdAt: createdAt ?? this.createdAt,
    updatedAt: updatedAt ?? this.updatedAt,
  );
  ExtractedItem copyWithCompanion(ExtractedItemsCompanion data) {
    return ExtractedItem(
      itemId: data.itemId.present ? data.itemId.value : this.itemId,
      meetingId: data.meetingId.present ? data.meetingId.value : this.meetingId,
      itemType: data.itemType.present ? data.itemType.value : this.itemType,
      status: data.status.present ? data.status.value : this.status,
      content: data.content.present ? data.content.value : this.content,
      confidence: data.confidence.present
          ? data.confidence.value
          : this.confidence,
      ownerLabel: data.ownerLabel.present
          ? data.ownerLabel.value
          : this.ownerLabel,
      dueDate: data.dueDate.present ? data.dueDate.value : this.dueDate,
      dueTime: data.dueTime.present ? data.dueTime.value : this.dueTime,
      scheduledCalendarEventId: data.scheduledCalendarEventId.present
          ? data.scheduledCalendarEventId.value
          : this.scheduledCalendarEventId,
      confirmedAt: data.confirmedAt.present
          ? data.confirmedAt.value
          : this.confirmedAt,
      scheduledAt: data.scheduledAt.present
          ? data.scheduledAt.value
          : this.scheduledAt,
      completedAt: data.completedAt.present
          ? data.completedAt.value
          : this.completedAt,
      archivedAt: data.archivedAt.present
          ? data.archivedAt.value
          : this.archivedAt,
      createdAt: data.createdAt.present ? data.createdAt.value : this.createdAt,
      updatedAt: data.updatedAt.present ? data.updatedAt.value : this.updatedAt,
    );
  }

  @override
  String toString() {
    return (StringBuffer('ExtractedItem(')
          ..write('itemId: $itemId, ')
          ..write('meetingId: $meetingId, ')
          ..write('itemType: $itemType, ')
          ..write('status: $status, ')
          ..write('content: $content, ')
          ..write('confidence: $confidence, ')
          ..write('ownerLabel: $ownerLabel, ')
          ..write('dueDate: $dueDate, ')
          ..write('dueTime: $dueTime, ')
          ..write('scheduledCalendarEventId: $scheduledCalendarEventId, ')
          ..write('confirmedAt: $confirmedAt, ')
          ..write('scheduledAt: $scheduledAt, ')
          ..write('completedAt: $completedAt, ')
          ..write('archivedAt: $archivedAt, ')
          ..write('createdAt: $createdAt, ')
          ..write('updatedAt: $updatedAt')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(
    itemId,
    meetingId,
    itemType,
    status,
    content,
    confidence,
    ownerLabel,
    dueDate,
    dueTime,
    scheduledCalendarEventId,
    confirmedAt,
    scheduledAt,
    completedAt,
    archivedAt,
    createdAt,
    updatedAt,
  );
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is ExtractedItem &&
          other.itemId == this.itemId &&
          other.meetingId == this.meetingId &&
          other.itemType == this.itemType &&
          other.status == this.status &&
          other.content == this.content &&
          other.confidence == this.confidence &&
          other.ownerLabel == this.ownerLabel &&
          other.dueDate == this.dueDate &&
          other.dueTime == this.dueTime &&
          other.scheduledCalendarEventId == this.scheduledCalendarEventId &&
          other.confirmedAt == this.confirmedAt &&
          other.scheduledAt == this.scheduledAt &&
          other.completedAt == this.completedAt &&
          other.archivedAt == this.archivedAt &&
          other.createdAt == this.createdAt &&
          other.updatedAt == this.updatedAt);
}

class ExtractedItemsCompanion extends UpdateCompanion<ExtractedItem> {
  final Value<String> itemId;
  final Value<String> meetingId;
  final Value<String> itemType;
  final Value<String> status;
  final Value<String> content;
  final Value<double?> confidence;
  final Value<String?> ownerLabel;
  final Value<String?> dueDate;
  final Value<String?> dueTime;
  final Value<String?> scheduledCalendarEventId;
  final Value<DateTime?> confirmedAt;
  final Value<DateTime?> scheduledAt;
  final Value<DateTime?> completedAt;
  final Value<DateTime?> archivedAt;
  final Value<DateTime> createdAt;
  final Value<DateTime> updatedAt;
  final Value<int> rowid;
  const ExtractedItemsCompanion({
    this.itemId = const Value.absent(),
    this.meetingId = const Value.absent(),
    this.itemType = const Value.absent(),
    this.status = const Value.absent(),
    this.content = const Value.absent(),
    this.confidence = const Value.absent(),
    this.ownerLabel = const Value.absent(),
    this.dueDate = const Value.absent(),
    this.dueTime = const Value.absent(),
    this.scheduledCalendarEventId = const Value.absent(),
    this.confirmedAt = const Value.absent(),
    this.scheduledAt = const Value.absent(),
    this.completedAt = const Value.absent(),
    this.archivedAt = const Value.absent(),
    this.createdAt = const Value.absent(),
    this.updatedAt = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  ExtractedItemsCompanion.insert({
    required String itemId,
    required String meetingId,
    required String itemType,
    this.status = const Value.absent(),
    required String content,
    this.confidence = const Value.absent(),
    this.ownerLabel = const Value.absent(),
    this.dueDate = const Value.absent(),
    this.dueTime = const Value.absent(),
    this.scheduledCalendarEventId = const Value.absent(),
    this.confirmedAt = const Value.absent(),
    this.scheduledAt = const Value.absent(),
    this.completedAt = const Value.absent(),
    this.archivedAt = const Value.absent(),
    this.createdAt = const Value.absent(),
    this.updatedAt = const Value.absent(),
    this.rowid = const Value.absent(),
  }) : itemId = Value(itemId),
       meetingId = Value(meetingId),
       itemType = Value(itemType),
       content = Value(content);
  static Insertable<ExtractedItem> custom({
    Expression<String>? itemId,
    Expression<String>? meetingId,
    Expression<String>? itemType,
    Expression<String>? status,
    Expression<String>? content,
    Expression<double>? confidence,
    Expression<String>? ownerLabel,
    Expression<String>? dueDate,
    Expression<String>? dueTime,
    Expression<String>? scheduledCalendarEventId,
    Expression<DateTime>? confirmedAt,
    Expression<DateTime>? scheduledAt,
    Expression<DateTime>? completedAt,
    Expression<DateTime>? archivedAt,
    Expression<DateTime>? createdAt,
    Expression<DateTime>? updatedAt,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (itemId != null) 'item_id': itemId,
      if (meetingId != null) 'meeting_id': meetingId,
      if (itemType != null) 'item_type': itemType,
      if (status != null) 'status': status,
      if (content != null) 'content': content,
      if (confidence != null) 'confidence': confidence,
      if (ownerLabel != null) 'owner_label': ownerLabel,
      if (dueDate != null) 'due_date': dueDate,
      if (dueTime != null) 'due_time': dueTime,
      if (scheduledCalendarEventId != null)
        'scheduled_calendar_event_id': scheduledCalendarEventId,
      if (confirmedAt != null) 'confirmed_at': confirmedAt,
      if (scheduledAt != null) 'scheduled_at': scheduledAt,
      if (completedAt != null) 'completed_at': completedAt,
      if (archivedAt != null) 'archived_at': archivedAt,
      if (createdAt != null) 'created_at': createdAt,
      if (updatedAt != null) 'updated_at': updatedAt,
      if (rowid != null) 'rowid': rowid,
    });
  }

  ExtractedItemsCompanion copyWith({
    Value<String>? itemId,
    Value<String>? meetingId,
    Value<String>? itemType,
    Value<String>? status,
    Value<String>? content,
    Value<double?>? confidence,
    Value<String?>? ownerLabel,
    Value<String?>? dueDate,
    Value<String?>? dueTime,
    Value<String?>? scheduledCalendarEventId,
    Value<DateTime?>? confirmedAt,
    Value<DateTime?>? scheduledAt,
    Value<DateTime?>? completedAt,
    Value<DateTime?>? archivedAt,
    Value<DateTime>? createdAt,
    Value<DateTime>? updatedAt,
    Value<int>? rowid,
  }) {
    return ExtractedItemsCompanion(
      itemId: itemId ?? this.itemId,
      meetingId: meetingId ?? this.meetingId,
      itemType: itemType ?? this.itemType,
      status: status ?? this.status,
      content: content ?? this.content,
      confidence: confidence ?? this.confidence,
      ownerLabel: ownerLabel ?? this.ownerLabel,
      dueDate: dueDate ?? this.dueDate,
      dueTime: dueTime ?? this.dueTime,
      scheduledCalendarEventId:
          scheduledCalendarEventId ?? this.scheduledCalendarEventId,
      confirmedAt: confirmedAt ?? this.confirmedAt,
      scheduledAt: scheduledAt ?? this.scheduledAt,
      completedAt: completedAt ?? this.completedAt,
      archivedAt: archivedAt ?? this.archivedAt,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (itemId.present) {
      map['item_id'] = Variable<String>(itemId.value);
    }
    if (meetingId.present) {
      map['meeting_id'] = Variable<String>(meetingId.value);
    }
    if (itemType.present) {
      map['item_type'] = Variable<String>(itemType.value);
    }
    if (status.present) {
      map['status'] = Variable<String>(status.value);
    }
    if (content.present) {
      map['content'] = Variable<String>(content.value);
    }
    if (confidence.present) {
      map['confidence'] = Variable<double>(confidence.value);
    }
    if (ownerLabel.present) {
      map['owner_label'] = Variable<String>(ownerLabel.value);
    }
    if (dueDate.present) {
      map['due_date'] = Variable<String>(dueDate.value);
    }
    if (dueTime.present) {
      map['due_time'] = Variable<String>(dueTime.value);
    }
    if (scheduledCalendarEventId.present) {
      map['scheduled_calendar_event_id'] = Variable<String>(
        scheduledCalendarEventId.value,
      );
    }
    if (confirmedAt.present) {
      map['confirmed_at'] = Variable<DateTime>(confirmedAt.value);
    }
    if (scheduledAt.present) {
      map['scheduled_at'] = Variable<DateTime>(scheduledAt.value);
    }
    if (completedAt.present) {
      map['completed_at'] = Variable<DateTime>(completedAt.value);
    }
    if (archivedAt.present) {
      map['archived_at'] = Variable<DateTime>(archivedAt.value);
    }
    if (createdAt.present) {
      map['created_at'] = Variable<DateTime>(createdAt.value);
    }
    if (updatedAt.present) {
      map['updated_at'] = Variable<DateTime>(updatedAt.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('ExtractedItemsCompanion(')
          ..write('itemId: $itemId, ')
          ..write('meetingId: $meetingId, ')
          ..write('itemType: $itemType, ')
          ..write('status: $status, ')
          ..write('content: $content, ')
          ..write('confidence: $confidence, ')
          ..write('ownerLabel: $ownerLabel, ')
          ..write('dueDate: $dueDate, ')
          ..write('dueTime: $dueTime, ')
          ..write('scheduledCalendarEventId: $scheduledCalendarEventId, ')
          ..write('confirmedAt: $confirmedAt, ')
          ..write('scheduledAt: $scheduledAt, ')
          ..write('completedAt: $completedAt, ')
          ..write('archivedAt: $archivedAt, ')
          ..write('createdAt: $createdAt, ')
          ..write('updatedAt: $updatedAt, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $MealRecordsTable extends MealRecords
    with TableInfo<$MealRecordsTable, MealRecord> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $MealRecordsTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _mealIdMeta = const VerificationMeta('mealId');
  @override
  late final GeneratedColumn<String> mealId = GeneratedColumn<String>(
    'meal_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _userIdMeta = const VerificationMeta('userId');
  @override
  late final GeneratedColumn<String> userId = GeneratedColumn<String>(
    'user_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _eatenAtMeta = const VerificationMeta(
    'eatenAt',
  );
  @override
  late final GeneratedColumn<DateTime> eatenAt = GeneratedColumn<DateTime>(
    'eaten_at',
    aliasedName,
    false,
    type: DriftSqlType.dateTime,
    requiredDuringInsert: false,
    defaultValue: currentDateAndTime,
  );
  static const VerificationMeta _mealTypeMeta = const VerificationMeta(
    'mealType',
  );
  @override
  late final GeneratedColumn<String> mealType = GeneratedColumn<String>(
    'meal_type',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _photoPathMeta = const VerificationMeta(
    'photoPath',
  );
  @override
  late final GeneratedColumn<String> photoPath = GeneratedColumn<String>(
    'photo_path',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _descriptionMeta = const VerificationMeta(
    'description',
  );
  @override
  late final GeneratedColumn<String> description = GeneratedColumn<String>(
    'description',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _locationLabelMeta = const VerificationMeta(
    'locationLabel',
  );
  @override
  late final GeneratedColumn<String> locationLabel = GeneratedColumn<String>(
    'location_label',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _locationLatMeta = const VerificationMeta(
    'locationLat',
  );
  @override
  late final GeneratedColumn<double> locationLat = GeneratedColumn<double>(
    'location_lat',
    aliasedName,
    true,
    type: DriftSqlType.double,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _locationLngMeta = const VerificationMeta(
    'locationLng',
  );
  @override
  late final GeneratedColumn<double> locationLng = GeneratedColumn<double>(
    'location_lng',
    aliasedName,
    true,
    type: DriftSqlType.double,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _amountMeta = const VerificationMeta('amount');
  @override
  late final GeneratedColumn<int> amount = GeneratedColumn<int>(
    'amount',
    aliasedName,
    true,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _isAmountEstimatedMeta = const VerificationMeta(
    'isAmountEstimated',
  );
  @override
  late final GeneratedColumn<bool> isAmountEstimated = GeneratedColumn<bool>(
    'is_amount_estimated',
    aliasedName,
    false,
    type: DriftSqlType.bool,
    requiredDuringInsert: false,
    defaultConstraints: GeneratedColumn.constraintIsAlways(
      'CHECK ("is_amount_estimated" IN (0, 1))',
    ),
    defaultValue: const Constant(false),
  );
  static const VerificationMeta _extractedIdMeta = const VerificationMeta(
    'extractedId',
  );
  @override
  late final GeneratedColumn<String> extractedId = GeneratedColumn<String>(
    'extracted_id',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _nutritionAnalysisJsonMeta =
      const VerificationMeta('nutritionAnalysisJson');
  @override
  late final GeneratedColumn<String> nutritionAnalysisJson =
      GeneratedColumn<String>(
        'nutrition_analysis_json',
        aliasedName,
        true,
        type: DriftSqlType.string,
        requiredDuringInsert: false,
      );
  static const VerificationMeta _nutritionAnalyzedAtMeta =
      const VerificationMeta('nutritionAnalyzedAt');
  @override
  late final GeneratedColumn<DateTime> nutritionAnalyzedAt =
      GeneratedColumn<DateTime>(
        'nutrition_analyzed_at',
        aliasedName,
        true,
        type: DriftSqlType.dateTime,
        requiredDuringInsert: false,
      );
  static const VerificationMeta _createdAtMeta = const VerificationMeta(
    'createdAt',
  );
  @override
  late final GeneratedColumn<DateTime> createdAt = GeneratedColumn<DateTime>(
    'created_at',
    aliasedName,
    false,
    type: DriftSqlType.dateTime,
    requiredDuringInsert: false,
    defaultValue: currentDateAndTime,
  );
  @override
  List<GeneratedColumn> get $columns => [
    mealId,
    userId,
    eatenAt,
    mealType,
    photoPath,
    description,
    locationLabel,
    locationLat,
    locationLng,
    amount,
    isAmountEstimated,
    extractedId,
    nutritionAnalysisJson,
    nutritionAnalyzedAt,
    createdAt,
  ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'meal_records';
  @override
  VerificationContext validateIntegrity(
    Insertable<MealRecord> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('meal_id')) {
      context.handle(
        _mealIdMeta,
        mealId.isAcceptableOrUnknown(data['meal_id']!, _mealIdMeta),
      );
    } else if (isInserting) {
      context.missing(_mealIdMeta);
    }
    if (data.containsKey('user_id')) {
      context.handle(
        _userIdMeta,
        userId.isAcceptableOrUnknown(data['user_id']!, _userIdMeta),
      );
    } else if (isInserting) {
      context.missing(_userIdMeta);
    }
    if (data.containsKey('eaten_at')) {
      context.handle(
        _eatenAtMeta,
        eatenAt.isAcceptableOrUnknown(data['eaten_at']!, _eatenAtMeta),
      );
    }
    if (data.containsKey('meal_type')) {
      context.handle(
        _mealTypeMeta,
        mealType.isAcceptableOrUnknown(data['meal_type']!, _mealTypeMeta),
      );
    }
    if (data.containsKey('photo_path')) {
      context.handle(
        _photoPathMeta,
        photoPath.isAcceptableOrUnknown(data['photo_path']!, _photoPathMeta),
      );
    }
    if (data.containsKey('description')) {
      context.handle(
        _descriptionMeta,
        description.isAcceptableOrUnknown(
          data['description']!,
          _descriptionMeta,
        ),
      );
    }
    if (data.containsKey('location_label')) {
      context.handle(
        _locationLabelMeta,
        locationLabel.isAcceptableOrUnknown(
          data['location_label']!,
          _locationLabelMeta,
        ),
      );
    }
    if (data.containsKey('location_lat')) {
      context.handle(
        _locationLatMeta,
        locationLat.isAcceptableOrUnknown(
          data['location_lat']!,
          _locationLatMeta,
        ),
      );
    }
    if (data.containsKey('location_lng')) {
      context.handle(
        _locationLngMeta,
        locationLng.isAcceptableOrUnknown(
          data['location_lng']!,
          _locationLngMeta,
        ),
      );
    }
    if (data.containsKey('amount')) {
      context.handle(
        _amountMeta,
        amount.isAcceptableOrUnknown(data['amount']!, _amountMeta),
      );
    }
    if (data.containsKey('is_amount_estimated')) {
      context.handle(
        _isAmountEstimatedMeta,
        isAmountEstimated.isAcceptableOrUnknown(
          data['is_amount_estimated']!,
          _isAmountEstimatedMeta,
        ),
      );
    }
    if (data.containsKey('extracted_id')) {
      context.handle(
        _extractedIdMeta,
        extractedId.isAcceptableOrUnknown(
          data['extracted_id']!,
          _extractedIdMeta,
        ),
      );
    }
    if (data.containsKey('nutrition_analysis_json')) {
      context.handle(
        _nutritionAnalysisJsonMeta,
        nutritionAnalysisJson.isAcceptableOrUnknown(
          data['nutrition_analysis_json']!,
          _nutritionAnalysisJsonMeta,
        ),
      );
    }
    if (data.containsKey('nutrition_analyzed_at')) {
      context.handle(
        _nutritionAnalyzedAtMeta,
        nutritionAnalyzedAt.isAcceptableOrUnknown(
          data['nutrition_analyzed_at']!,
          _nutritionAnalyzedAtMeta,
        ),
      );
    }
    if (data.containsKey('created_at')) {
      context.handle(
        _createdAtMeta,
        createdAt.isAcceptableOrUnknown(data['created_at']!, _createdAtMeta),
      );
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {mealId};
  @override
  MealRecord map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return MealRecord(
      mealId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}meal_id'],
      )!,
      userId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}user_id'],
      )!,
      eatenAt: attachedDatabase.typeMapping.read(
        DriftSqlType.dateTime,
        data['${effectivePrefix}eaten_at'],
      )!,
      mealType: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}meal_type'],
      ),
      photoPath: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}photo_path'],
      ),
      description: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}description'],
      ),
      locationLabel: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}location_label'],
      ),
      locationLat: attachedDatabase.typeMapping.read(
        DriftSqlType.double,
        data['${effectivePrefix}location_lat'],
      ),
      locationLng: attachedDatabase.typeMapping.read(
        DriftSqlType.double,
        data['${effectivePrefix}location_lng'],
      ),
      amount: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}amount'],
      ),
      isAmountEstimated: attachedDatabase.typeMapping.read(
        DriftSqlType.bool,
        data['${effectivePrefix}is_amount_estimated'],
      )!,
      extractedId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}extracted_id'],
      ),
      nutritionAnalysisJson: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}nutrition_analysis_json'],
      ),
      nutritionAnalyzedAt: attachedDatabase.typeMapping.read(
        DriftSqlType.dateTime,
        data['${effectivePrefix}nutrition_analyzed_at'],
      ),
      createdAt: attachedDatabase.typeMapping.read(
        DriftSqlType.dateTime,
        data['${effectivePrefix}created_at'],
      )!,
    );
  }

  @override
  $MealRecordsTable createAlias(String alias) {
    return $MealRecordsTable(attachedDatabase, alias);
  }
}

class MealRecord extends DataClass implements Insertable<MealRecord> {
  final String mealId;
  final String userId;
  final DateTime eatenAt;
  final String? mealType;
  final String? photoPath;
  final String? description;
  final String? locationLabel;
  final double? locationLat;
  final double? locationLng;
  final int? amount;
  final bool isAmountEstimated;
  final String? extractedId;
  final String? nutritionAnalysisJson;
  final DateTime? nutritionAnalyzedAt;
  final DateTime createdAt;
  const MealRecord({
    required this.mealId,
    required this.userId,
    required this.eatenAt,
    this.mealType,
    this.photoPath,
    this.description,
    this.locationLabel,
    this.locationLat,
    this.locationLng,
    this.amount,
    required this.isAmountEstimated,
    this.extractedId,
    this.nutritionAnalysisJson,
    this.nutritionAnalyzedAt,
    required this.createdAt,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['meal_id'] = Variable<String>(mealId);
    map['user_id'] = Variable<String>(userId);
    map['eaten_at'] = Variable<DateTime>(eatenAt);
    if (!nullToAbsent || mealType != null) {
      map['meal_type'] = Variable<String>(mealType);
    }
    if (!nullToAbsent || photoPath != null) {
      map['photo_path'] = Variable<String>(photoPath);
    }
    if (!nullToAbsent || description != null) {
      map['description'] = Variable<String>(description);
    }
    if (!nullToAbsent || locationLabel != null) {
      map['location_label'] = Variable<String>(locationLabel);
    }
    if (!nullToAbsent || locationLat != null) {
      map['location_lat'] = Variable<double>(locationLat);
    }
    if (!nullToAbsent || locationLng != null) {
      map['location_lng'] = Variable<double>(locationLng);
    }
    if (!nullToAbsent || amount != null) {
      map['amount'] = Variable<int>(amount);
    }
    map['is_amount_estimated'] = Variable<bool>(isAmountEstimated);
    if (!nullToAbsent || extractedId != null) {
      map['extracted_id'] = Variable<String>(extractedId);
    }
    if (!nullToAbsent || nutritionAnalysisJson != null) {
      map['nutrition_analysis_json'] = Variable<String>(nutritionAnalysisJson);
    }
    if (!nullToAbsent || nutritionAnalyzedAt != null) {
      map['nutrition_analyzed_at'] = Variable<DateTime>(nutritionAnalyzedAt);
    }
    map['created_at'] = Variable<DateTime>(createdAt);
    return map;
  }

  MealRecordsCompanion toCompanion(bool nullToAbsent) {
    return MealRecordsCompanion(
      mealId: Value(mealId),
      userId: Value(userId),
      eatenAt: Value(eatenAt),
      mealType: mealType == null && nullToAbsent
          ? const Value.absent()
          : Value(mealType),
      photoPath: photoPath == null && nullToAbsent
          ? const Value.absent()
          : Value(photoPath),
      description: description == null && nullToAbsent
          ? const Value.absent()
          : Value(description),
      locationLabel: locationLabel == null && nullToAbsent
          ? const Value.absent()
          : Value(locationLabel),
      locationLat: locationLat == null && nullToAbsent
          ? const Value.absent()
          : Value(locationLat),
      locationLng: locationLng == null && nullToAbsent
          ? const Value.absent()
          : Value(locationLng),
      amount: amount == null && nullToAbsent
          ? const Value.absent()
          : Value(amount),
      isAmountEstimated: Value(isAmountEstimated),
      extractedId: extractedId == null && nullToAbsent
          ? const Value.absent()
          : Value(extractedId),
      nutritionAnalysisJson: nutritionAnalysisJson == null && nullToAbsent
          ? const Value.absent()
          : Value(nutritionAnalysisJson),
      nutritionAnalyzedAt: nutritionAnalyzedAt == null && nullToAbsent
          ? const Value.absent()
          : Value(nutritionAnalyzedAt),
      createdAt: Value(createdAt),
    );
  }

  factory MealRecord.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return MealRecord(
      mealId: serializer.fromJson<String>(json['mealId']),
      userId: serializer.fromJson<String>(json['userId']),
      eatenAt: serializer.fromJson<DateTime>(json['eatenAt']),
      mealType: serializer.fromJson<String?>(json['mealType']),
      photoPath: serializer.fromJson<String?>(json['photoPath']),
      description: serializer.fromJson<String?>(json['description']),
      locationLabel: serializer.fromJson<String?>(json['locationLabel']),
      locationLat: serializer.fromJson<double?>(json['locationLat']),
      locationLng: serializer.fromJson<double?>(json['locationLng']),
      amount: serializer.fromJson<int?>(json['amount']),
      isAmountEstimated: serializer.fromJson<bool>(json['isAmountEstimated']),
      extractedId: serializer.fromJson<String?>(json['extractedId']),
      nutritionAnalysisJson: serializer.fromJson<String?>(
        json['nutritionAnalysisJson'],
      ),
      nutritionAnalyzedAt: serializer.fromJson<DateTime?>(
        json['nutritionAnalyzedAt'],
      ),
      createdAt: serializer.fromJson<DateTime>(json['createdAt']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'mealId': serializer.toJson<String>(mealId),
      'userId': serializer.toJson<String>(userId),
      'eatenAt': serializer.toJson<DateTime>(eatenAt),
      'mealType': serializer.toJson<String?>(mealType),
      'photoPath': serializer.toJson<String?>(photoPath),
      'description': serializer.toJson<String?>(description),
      'locationLabel': serializer.toJson<String?>(locationLabel),
      'locationLat': serializer.toJson<double?>(locationLat),
      'locationLng': serializer.toJson<double?>(locationLng),
      'amount': serializer.toJson<int?>(amount),
      'isAmountEstimated': serializer.toJson<bool>(isAmountEstimated),
      'extractedId': serializer.toJson<String?>(extractedId),
      'nutritionAnalysisJson': serializer.toJson<String?>(
        nutritionAnalysisJson,
      ),
      'nutritionAnalyzedAt': serializer.toJson<DateTime?>(nutritionAnalyzedAt),
      'createdAt': serializer.toJson<DateTime>(createdAt),
    };
  }

  MealRecord copyWith({
    String? mealId,
    String? userId,
    DateTime? eatenAt,
    Value<String?> mealType = const Value.absent(),
    Value<String?> photoPath = const Value.absent(),
    Value<String?> description = const Value.absent(),
    Value<String?> locationLabel = const Value.absent(),
    Value<double?> locationLat = const Value.absent(),
    Value<double?> locationLng = const Value.absent(),
    Value<int?> amount = const Value.absent(),
    bool? isAmountEstimated,
    Value<String?> extractedId = const Value.absent(),
    Value<String?> nutritionAnalysisJson = const Value.absent(),
    Value<DateTime?> nutritionAnalyzedAt = const Value.absent(),
    DateTime? createdAt,
  }) => MealRecord(
    mealId: mealId ?? this.mealId,
    userId: userId ?? this.userId,
    eatenAt: eatenAt ?? this.eatenAt,
    mealType: mealType.present ? mealType.value : this.mealType,
    photoPath: photoPath.present ? photoPath.value : this.photoPath,
    description: description.present ? description.value : this.description,
    locationLabel: locationLabel.present
        ? locationLabel.value
        : this.locationLabel,
    locationLat: locationLat.present ? locationLat.value : this.locationLat,
    locationLng: locationLng.present ? locationLng.value : this.locationLng,
    amount: amount.present ? amount.value : this.amount,
    isAmountEstimated: isAmountEstimated ?? this.isAmountEstimated,
    extractedId: extractedId.present ? extractedId.value : this.extractedId,
    nutritionAnalysisJson: nutritionAnalysisJson.present
        ? nutritionAnalysisJson.value
        : this.nutritionAnalysisJson,
    nutritionAnalyzedAt: nutritionAnalyzedAt.present
        ? nutritionAnalyzedAt.value
        : this.nutritionAnalyzedAt,
    createdAt: createdAt ?? this.createdAt,
  );
  MealRecord copyWithCompanion(MealRecordsCompanion data) {
    return MealRecord(
      mealId: data.mealId.present ? data.mealId.value : this.mealId,
      userId: data.userId.present ? data.userId.value : this.userId,
      eatenAt: data.eatenAt.present ? data.eatenAt.value : this.eatenAt,
      mealType: data.mealType.present ? data.mealType.value : this.mealType,
      photoPath: data.photoPath.present ? data.photoPath.value : this.photoPath,
      description: data.description.present
          ? data.description.value
          : this.description,
      locationLabel: data.locationLabel.present
          ? data.locationLabel.value
          : this.locationLabel,
      locationLat: data.locationLat.present
          ? data.locationLat.value
          : this.locationLat,
      locationLng: data.locationLng.present
          ? data.locationLng.value
          : this.locationLng,
      amount: data.amount.present ? data.amount.value : this.amount,
      isAmountEstimated: data.isAmountEstimated.present
          ? data.isAmountEstimated.value
          : this.isAmountEstimated,
      extractedId: data.extractedId.present
          ? data.extractedId.value
          : this.extractedId,
      nutritionAnalysisJson: data.nutritionAnalysisJson.present
          ? data.nutritionAnalysisJson.value
          : this.nutritionAnalysisJson,
      nutritionAnalyzedAt: data.nutritionAnalyzedAt.present
          ? data.nutritionAnalyzedAt.value
          : this.nutritionAnalyzedAt,
      createdAt: data.createdAt.present ? data.createdAt.value : this.createdAt,
    );
  }

  @override
  String toString() {
    return (StringBuffer('MealRecord(')
          ..write('mealId: $mealId, ')
          ..write('userId: $userId, ')
          ..write('eatenAt: $eatenAt, ')
          ..write('mealType: $mealType, ')
          ..write('photoPath: $photoPath, ')
          ..write('description: $description, ')
          ..write('locationLabel: $locationLabel, ')
          ..write('locationLat: $locationLat, ')
          ..write('locationLng: $locationLng, ')
          ..write('amount: $amount, ')
          ..write('isAmountEstimated: $isAmountEstimated, ')
          ..write('extractedId: $extractedId, ')
          ..write('nutritionAnalysisJson: $nutritionAnalysisJson, ')
          ..write('nutritionAnalyzedAt: $nutritionAnalyzedAt, ')
          ..write('createdAt: $createdAt')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(
    mealId,
    userId,
    eatenAt,
    mealType,
    photoPath,
    description,
    locationLabel,
    locationLat,
    locationLng,
    amount,
    isAmountEstimated,
    extractedId,
    nutritionAnalysisJson,
    nutritionAnalyzedAt,
    createdAt,
  );
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is MealRecord &&
          other.mealId == this.mealId &&
          other.userId == this.userId &&
          other.eatenAt == this.eatenAt &&
          other.mealType == this.mealType &&
          other.photoPath == this.photoPath &&
          other.description == this.description &&
          other.locationLabel == this.locationLabel &&
          other.locationLat == this.locationLat &&
          other.locationLng == this.locationLng &&
          other.amount == this.amount &&
          other.isAmountEstimated == this.isAmountEstimated &&
          other.extractedId == this.extractedId &&
          other.nutritionAnalysisJson == this.nutritionAnalysisJson &&
          other.nutritionAnalyzedAt == this.nutritionAnalyzedAt &&
          other.createdAt == this.createdAt);
}

class MealRecordsCompanion extends UpdateCompanion<MealRecord> {
  final Value<String> mealId;
  final Value<String> userId;
  final Value<DateTime> eatenAt;
  final Value<String?> mealType;
  final Value<String?> photoPath;
  final Value<String?> description;
  final Value<String?> locationLabel;
  final Value<double?> locationLat;
  final Value<double?> locationLng;
  final Value<int?> amount;
  final Value<bool> isAmountEstimated;
  final Value<String?> extractedId;
  final Value<String?> nutritionAnalysisJson;
  final Value<DateTime?> nutritionAnalyzedAt;
  final Value<DateTime> createdAt;
  final Value<int> rowid;
  const MealRecordsCompanion({
    this.mealId = const Value.absent(),
    this.userId = const Value.absent(),
    this.eatenAt = const Value.absent(),
    this.mealType = const Value.absent(),
    this.photoPath = const Value.absent(),
    this.description = const Value.absent(),
    this.locationLabel = const Value.absent(),
    this.locationLat = const Value.absent(),
    this.locationLng = const Value.absent(),
    this.amount = const Value.absent(),
    this.isAmountEstimated = const Value.absent(),
    this.extractedId = const Value.absent(),
    this.nutritionAnalysisJson = const Value.absent(),
    this.nutritionAnalyzedAt = const Value.absent(),
    this.createdAt = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  MealRecordsCompanion.insert({
    required String mealId,
    required String userId,
    this.eatenAt = const Value.absent(),
    this.mealType = const Value.absent(),
    this.photoPath = const Value.absent(),
    this.description = const Value.absent(),
    this.locationLabel = const Value.absent(),
    this.locationLat = const Value.absent(),
    this.locationLng = const Value.absent(),
    this.amount = const Value.absent(),
    this.isAmountEstimated = const Value.absent(),
    this.extractedId = const Value.absent(),
    this.nutritionAnalysisJson = const Value.absent(),
    this.nutritionAnalyzedAt = const Value.absent(),
    this.createdAt = const Value.absent(),
    this.rowid = const Value.absent(),
  }) : mealId = Value(mealId),
       userId = Value(userId);
  static Insertable<MealRecord> custom({
    Expression<String>? mealId,
    Expression<String>? userId,
    Expression<DateTime>? eatenAt,
    Expression<String>? mealType,
    Expression<String>? photoPath,
    Expression<String>? description,
    Expression<String>? locationLabel,
    Expression<double>? locationLat,
    Expression<double>? locationLng,
    Expression<int>? amount,
    Expression<bool>? isAmountEstimated,
    Expression<String>? extractedId,
    Expression<String>? nutritionAnalysisJson,
    Expression<DateTime>? nutritionAnalyzedAt,
    Expression<DateTime>? createdAt,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (mealId != null) 'meal_id': mealId,
      if (userId != null) 'user_id': userId,
      if (eatenAt != null) 'eaten_at': eatenAt,
      if (mealType != null) 'meal_type': mealType,
      if (photoPath != null) 'photo_path': photoPath,
      if (description != null) 'description': description,
      if (locationLabel != null) 'location_label': locationLabel,
      if (locationLat != null) 'location_lat': locationLat,
      if (locationLng != null) 'location_lng': locationLng,
      if (amount != null) 'amount': amount,
      if (isAmountEstimated != null) 'is_amount_estimated': isAmountEstimated,
      if (extractedId != null) 'extracted_id': extractedId,
      if (nutritionAnalysisJson != null)
        'nutrition_analysis_json': nutritionAnalysisJson,
      if (nutritionAnalyzedAt != null)
        'nutrition_analyzed_at': nutritionAnalyzedAt,
      if (createdAt != null) 'created_at': createdAt,
      if (rowid != null) 'rowid': rowid,
    });
  }

  MealRecordsCompanion copyWith({
    Value<String>? mealId,
    Value<String>? userId,
    Value<DateTime>? eatenAt,
    Value<String?>? mealType,
    Value<String?>? photoPath,
    Value<String?>? description,
    Value<String?>? locationLabel,
    Value<double?>? locationLat,
    Value<double?>? locationLng,
    Value<int?>? amount,
    Value<bool>? isAmountEstimated,
    Value<String?>? extractedId,
    Value<String?>? nutritionAnalysisJson,
    Value<DateTime?>? nutritionAnalyzedAt,
    Value<DateTime>? createdAt,
    Value<int>? rowid,
  }) {
    return MealRecordsCompanion(
      mealId: mealId ?? this.mealId,
      userId: userId ?? this.userId,
      eatenAt: eatenAt ?? this.eatenAt,
      mealType: mealType ?? this.mealType,
      photoPath: photoPath ?? this.photoPath,
      description: description ?? this.description,
      locationLabel: locationLabel ?? this.locationLabel,
      locationLat: locationLat ?? this.locationLat,
      locationLng: locationLng ?? this.locationLng,
      amount: amount ?? this.amount,
      isAmountEstimated: isAmountEstimated ?? this.isAmountEstimated,
      extractedId: extractedId ?? this.extractedId,
      nutritionAnalysisJson:
          nutritionAnalysisJson ?? this.nutritionAnalysisJson,
      nutritionAnalyzedAt: nutritionAnalyzedAt ?? this.nutritionAnalyzedAt,
      createdAt: createdAt ?? this.createdAt,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (mealId.present) {
      map['meal_id'] = Variable<String>(mealId.value);
    }
    if (userId.present) {
      map['user_id'] = Variable<String>(userId.value);
    }
    if (eatenAt.present) {
      map['eaten_at'] = Variable<DateTime>(eatenAt.value);
    }
    if (mealType.present) {
      map['meal_type'] = Variable<String>(mealType.value);
    }
    if (photoPath.present) {
      map['photo_path'] = Variable<String>(photoPath.value);
    }
    if (description.present) {
      map['description'] = Variable<String>(description.value);
    }
    if (locationLabel.present) {
      map['location_label'] = Variable<String>(locationLabel.value);
    }
    if (locationLat.present) {
      map['location_lat'] = Variable<double>(locationLat.value);
    }
    if (locationLng.present) {
      map['location_lng'] = Variable<double>(locationLng.value);
    }
    if (amount.present) {
      map['amount'] = Variable<int>(amount.value);
    }
    if (isAmountEstimated.present) {
      map['is_amount_estimated'] = Variable<bool>(isAmountEstimated.value);
    }
    if (extractedId.present) {
      map['extracted_id'] = Variable<String>(extractedId.value);
    }
    if (nutritionAnalysisJson.present) {
      map['nutrition_analysis_json'] = Variable<String>(
        nutritionAnalysisJson.value,
      );
    }
    if (nutritionAnalyzedAt.present) {
      map['nutrition_analyzed_at'] = Variable<DateTime>(
        nutritionAnalyzedAt.value,
      );
    }
    if (createdAt.present) {
      map['created_at'] = Variable<DateTime>(createdAt.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('MealRecordsCompanion(')
          ..write('mealId: $mealId, ')
          ..write('userId: $userId, ')
          ..write('eatenAt: $eatenAt, ')
          ..write('mealType: $mealType, ')
          ..write('photoPath: $photoPath, ')
          ..write('description: $description, ')
          ..write('locationLabel: $locationLabel, ')
          ..write('locationLat: $locationLat, ')
          ..write('locationLng: $locationLng, ')
          ..write('amount: $amount, ')
          ..write('isAmountEstimated: $isAmountEstimated, ')
          ..write('extractedId: $extractedId, ')
          ..write('nutritionAnalysisJson: $nutritionAnalysisJson, ')
          ..write('nutritionAnalyzedAt: $nutritionAnalyzedAt, ')
          ..write('createdAt: $createdAt, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $DailyContextsTable extends DailyContexts
    with TableInfo<$DailyContextsTable, DailyContext> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $DailyContextsTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _contextIdMeta = const VerificationMeta(
    'contextId',
  );
  @override
  late final GeneratedColumn<String> contextId = GeneratedColumn<String>(
    'context_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _userIdMeta = const VerificationMeta('userId');
  @override
  late final GeneratedColumn<String> userId = GeneratedColumn<String>(
    'user_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _recordedAtMeta = const VerificationMeta(
    'recordedAt',
  );
  @override
  late final GeneratedColumn<DateTime> recordedAt = GeneratedColumn<DateTime>(
    'recorded_at',
    aliasedName,
    false,
    type: DriftSqlType.dateTime,
    requiredDuringInsert: false,
    defaultValue: currentDateAndTime,
  );
  static const VerificationMeta _memoMeta = const VerificationMeta('memo');
  @override
  late final GeneratedColumn<String> memo = GeneratedColumn<String>(
    'memo',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _sleepHoursMeta = const VerificationMeta(
    'sleepHours',
  );
  @override
  late final GeneratedColumn<double> sleepHours = GeneratedColumn<double>(
    'sleep_hours',
    aliasedName,
    true,
    type: DriftSqlType.double,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _conditionScoreMeta = const VerificationMeta(
    'conditionScore',
  );
  @override
  late final GeneratedColumn<int> conditionScore = GeneratedColumn<int>(
    'condition_score',
    aliasedName,
    true,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _weatherLabelMeta = const VerificationMeta(
    'weatherLabel',
  );
  @override
  late final GeneratedColumn<String> weatherLabel = GeneratedColumn<String>(
    'weather_label',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _weatherTempMeta = const VerificationMeta(
    'weatherTemp',
  );
  @override
  late final GeneratedColumn<double> weatherTemp = GeneratedColumn<double>(
    'weather_temp',
    aliasedName,
    true,
    type: DriftSqlType.double,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _createdAtMeta = const VerificationMeta(
    'createdAt',
  );
  @override
  late final GeneratedColumn<DateTime> createdAt = GeneratedColumn<DateTime>(
    'created_at',
    aliasedName,
    false,
    type: DriftSqlType.dateTime,
    requiredDuringInsert: false,
    defaultValue: currentDateAndTime,
  );
  @override
  List<GeneratedColumn> get $columns => [
    contextId,
    userId,
    recordedAt,
    memo,
    sleepHours,
    conditionScore,
    weatherLabel,
    weatherTemp,
    createdAt,
  ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'daily_contexts';
  @override
  VerificationContext validateIntegrity(
    Insertable<DailyContext> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('context_id')) {
      context.handle(
        _contextIdMeta,
        contextId.isAcceptableOrUnknown(data['context_id']!, _contextIdMeta),
      );
    } else if (isInserting) {
      context.missing(_contextIdMeta);
    }
    if (data.containsKey('user_id')) {
      context.handle(
        _userIdMeta,
        userId.isAcceptableOrUnknown(data['user_id']!, _userIdMeta),
      );
    } else if (isInserting) {
      context.missing(_userIdMeta);
    }
    if (data.containsKey('recorded_at')) {
      context.handle(
        _recordedAtMeta,
        recordedAt.isAcceptableOrUnknown(data['recorded_at']!, _recordedAtMeta),
      );
    }
    if (data.containsKey('memo')) {
      context.handle(
        _memoMeta,
        memo.isAcceptableOrUnknown(data['memo']!, _memoMeta),
      );
    } else if (isInserting) {
      context.missing(_memoMeta);
    }
    if (data.containsKey('sleep_hours')) {
      context.handle(
        _sleepHoursMeta,
        sleepHours.isAcceptableOrUnknown(data['sleep_hours']!, _sleepHoursMeta),
      );
    }
    if (data.containsKey('condition_score')) {
      context.handle(
        _conditionScoreMeta,
        conditionScore.isAcceptableOrUnknown(
          data['condition_score']!,
          _conditionScoreMeta,
        ),
      );
    }
    if (data.containsKey('weather_label')) {
      context.handle(
        _weatherLabelMeta,
        weatherLabel.isAcceptableOrUnknown(
          data['weather_label']!,
          _weatherLabelMeta,
        ),
      );
    }
    if (data.containsKey('weather_temp')) {
      context.handle(
        _weatherTempMeta,
        weatherTemp.isAcceptableOrUnknown(
          data['weather_temp']!,
          _weatherTempMeta,
        ),
      );
    }
    if (data.containsKey('created_at')) {
      context.handle(
        _createdAtMeta,
        createdAt.isAcceptableOrUnknown(data['created_at']!, _createdAtMeta),
      );
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {contextId};
  @override
  DailyContext map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return DailyContext(
      contextId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}context_id'],
      )!,
      userId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}user_id'],
      )!,
      recordedAt: attachedDatabase.typeMapping.read(
        DriftSqlType.dateTime,
        data['${effectivePrefix}recorded_at'],
      )!,
      memo: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}memo'],
      )!,
      sleepHours: attachedDatabase.typeMapping.read(
        DriftSqlType.double,
        data['${effectivePrefix}sleep_hours'],
      ),
      conditionScore: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}condition_score'],
      ),
      weatherLabel: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}weather_label'],
      ),
      weatherTemp: attachedDatabase.typeMapping.read(
        DriftSqlType.double,
        data['${effectivePrefix}weather_temp'],
      ),
      createdAt: attachedDatabase.typeMapping.read(
        DriftSqlType.dateTime,
        data['${effectivePrefix}created_at'],
      )!,
    );
  }

  @override
  $DailyContextsTable createAlias(String alias) {
    return $DailyContextsTable(attachedDatabase, alias);
  }
}

class DailyContext extends DataClass implements Insertable<DailyContext> {
  final String contextId;
  final String userId;
  final DateTime recordedAt;
  final String memo;
  final double? sleepHours;
  final int? conditionScore;
  final String? weatherLabel;
  final double? weatherTemp;
  final DateTime createdAt;
  const DailyContext({
    required this.contextId,
    required this.userId,
    required this.recordedAt,
    required this.memo,
    this.sleepHours,
    this.conditionScore,
    this.weatherLabel,
    this.weatherTemp,
    required this.createdAt,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['context_id'] = Variable<String>(contextId);
    map['user_id'] = Variable<String>(userId);
    map['recorded_at'] = Variable<DateTime>(recordedAt);
    map['memo'] = Variable<String>(memo);
    if (!nullToAbsent || sleepHours != null) {
      map['sleep_hours'] = Variable<double>(sleepHours);
    }
    if (!nullToAbsent || conditionScore != null) {
      map['condition_score'] = Variable<int>(conditionScore);
    }
    if (!nullToAbsent || weatherLabel != null) {
      map['weather_label'] = Variable<String>(weatherLabel);
    }
    if (!nullToAbsent || weatherTemp != null) {
      map['weather_temp'] = Variable<double>(weatherTemp);
    }
    map['created_at'] = Variable<DateTime>(createdAt);
    return map;
  }

  DailyContextsCompanion toCompanion(bool nullToAbsent) {
    return DailyContextsCompanion(
      contextId: Value(contextId),
      userId: Value(userId),
      recordedAt: Value(recordedAt),
      memo: Value(memo),
      sleepHours: sleepHours == null && nullToAbsent
          ? const Value.absent()
          : Value(sleepHours),
      conditionScore: conditionScore == null && nullToAbsent
          ? const Value.absent()
          : Value(conditionScore),
      weatherLabel: weatherLabel == null && nullToAbsent
          ? const Value.absent()
          : Value(weatherLabel),
      weatherTemp: weatherTemp == null && nullToAbsent
          ? const Value.absent()
          : Value(weatherTemp),
      createdAt: Value(createdAt),
    );
  }

  factory DailyContext.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return DailyContext(
      contextId: serializer.fromJson<String>(json['contextId']),
      userId: serializer.fromJson<String>(json['userId']),
      recordedAt: serializer.fromJson<DateTime>(json['recordedAt']),
      memo: serializer.fromJson<String>(json['memo']),
      sleepHours: serializer.fromJson<double?>(json['sleepHours']),
      conditionScore: serializer.fromJson<int?>(json['conditionScore']),
      weatherLabel: serializer.fromJson<String?>(json['weatherLabel']),
      weatherTemp: serializer.fromJson<double?>(json['weatherTemp']),
      createdAt: serializer.fromJson<DateTime>(json['createdAt']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'contextId': serializer.toJson<String>(contextId),
      'userId': serializer.toJson<String>(userId),
      'recordedAt': serializer.toJson<DateTime>(recordedAt),
      'memo': serializer.toJson<String>(memo),
      'sleepHours': serializer.toJson<double?>(sleepHours),
      'conditionScore': serializer.toJson<int?>(conditionScore),
      'weatherLabel': serializer.toJson<String?>(weatherLabel),
      'weatherTemp': serializer.toJson<double?>(weatherTemp),
      'createdAt': serializer.toJson<DateTime>(createdAt),
    };
  }

  DailyContext copyWith({
    String? contextId,
    String? userId,
    DateTime? recordedAt,
    String? memo,
    Value<double?> sleepHours = const Value.absent(),
    Value<int?> conditionScore = const Value.absent(),
    Value<String?> weatherLabel = const Value.absent(),
    Value<double?> weatherTemp = const Value.absent(),
    DateTime? createdAt,
  }) => DailyContext(
    contextId: contextId ?? this.contextId,
    userId: userId ?? this.userId,
    recordedAt: recordedAt ?? this.recordedAt,
    memo: memo ?? this.memo,
    sleepHours: sleepHours.present ? sleepHours.value : this.sleepHours,
    conditionScore: conditionScore.present
        ? conditionScore.value
        : this.conditionScore,
    weatherLabel: weatherLabel.present ? weatherLabel.value : this.weatherLabel,
    weatherTemp: weatherTemp.present ? weatherTemp.value : this.weatherTemp,
    createdAt: createdAt ?? this.createdAt,
  );
  DailyContext copyWithCompanion(DailyContextsCompanion data) {
    return DailyContext(
      contextId: data.contextId.present ? data.contextId.value : this.contextId,
      userId: data.userId.present ? data.userId.value : this.userId,
      recordedAt: data.recordedAt.present
          ? data.recordedAt.value
          : this.recordedAt,
      memo: data.memo.present ? data.memo.value : this.memo,
      sleepHours: data.sleepHours.present
          ? data.sleepHours.value
          : this.sleepHours,
      conditionScore: data.conditionScore.present
          ? data.conditionScore.value
          : this.conditionScore,
      weatherLabel: data.weatherLabel.present
          ? data.weatherLabel.value
          : this.weatherLabel,
      weatherTemp: data.weatherTemp.present
          ? data.weatherTemp.value
          : this.weatherTemp,
      createdAt: data.createdAt.present ? data.createdAt.value : this.createdAt,
    );
  }

  @override
  String toString() {
    return (StringBuffer('DailyContext(')
          ..write('contextId: $contextId, ')
          ..write('userId: $userId, ')
          ..write('recordedAt: $recordedAt, ')
          ..write('memo: $memo, ')
          ..write('sleepHours: $sleepHours, ')
          ..write('conditionScore: $conditionScore, ')
          ..write('weatherLabel: $weatherLabel, ')
          ..write('weatherTemp: $weatherTemp, ')
          ..write('createdAt: $createdAt')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(
    contextId,
    userId,
    recordedAt,
    memo,
    sleepHours,
    conditionScore,
    weatherLabel,
    weatherTemp,
    createdAt,
  );
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is DailyContext &&
          other.contextId == this.contextId &&
          other.userId == this.userId &&
          other.recordedAt == this.recordedAt &&
          other.memo == this.memo &&
          other.sleepHours == this.sleepHours &&
          other.conditionScore == this.conditionScore &&
          other.weatherLabel == this.weatherLabel &&
          other.weatherTemp == this.weatherTemp &&
          other.createdAt == this.createdAt);
}

class DailyContextsCompanion extends UpdateCompanion<DailyContext> {
  final Value<String> contextId;
  final Value<String> userId;
  final Value<DateTime> recordedAt;
  final Value<String> memo;
  final Value<double?> sleepHours;
  final Value<int?> conditionScore;
  final Value<String?> weatherLabel;
  final Value<double?> weatherTemp;
  final Value<DateTime> createdAt;
  final Value<int> rowid;
  const DailyContextsCompanion({
    this.contextId = const Value.absent(),
    this.userId = const Value.absent(),
    this.recordedAt = const Value.absent(),
    this.memo = const Value.absent(),
    this.sleepHours = const Value.absent(),
    this.conditionScore = const Value.absent(),
    this.weatherLabel = const Value.absent(),
    this.weatherTemp = const Value.absent(),
    this.createdAt = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  DailyContextsCompanion.insert({
    required String contextId,
    required String userId,
    this.recordedAt = const Value.absent(),
    required String memo,
    this.sleepHours = const Value.absent(),
    this.conditionScore = const Value.absent(),
    this.weatherLabel = const Value.absent(),
    this.weatherTemp = const Value.absent(),
    this.createdAt = const Value.absent(),
    this.rowid = const Value.absent(),
  }) : contextId = Value(contextId),
       userId = Value(userId),
       memo = Value(memo);
  static Insertable<DailyContext> custom({
    Expression<String>? contextId,
    Expression<String>? userId,
    Expression<DateTime>? recordedAt,
    Expression<String>? memo,
    Expression<double>? sleepHours,
    Expression<int>? conditionScore,
    Expression<String>? weatherLabel,
    Expression<double>? weatherTemp,
    Expression<DateTime>? createdAt,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (contextId != null) 'context_id': contextId,
      if (userId != null) 'user_id': userId,
      if (recordedAt != null) 'recorded_at': recordedAt,
      if (memo != null) 'memo': memo,
      if (sleepHours != null) 'sleep_hours': sleepHours,
      if (conditionScore != null) 'condition_score': conditionScore,
      if (weatherLabel != null) 'weather_label': weatherLabel,
      if (weatherTemp != null) 'weather_temp': weatherTemp,
      if (createdAt != null) 'created_at': createdAt,
      if (rowid != null) 'rowid': rowid,
    });
  }

  DailyContextsCompanion copyWith({
    Value<String>? contextId,
    Value<String>? userId,
    Value<DateTime>? recordedAt,
    Value<String>? memo,
    Value<double?>? sleepHours,
    Value<int?>? conditionScore,
    Value<String?>? weatherLabel,
    Value<double?>? weatherTemp,
    Value<DateTime>? createdAt,
    Value<int>? rowid,
  }) {
    return DailyContextsCompanion(
      contextId: contextId ?? this.contextId,
      userId: userId ?? this.userId,
      recordedAt: recordedAt ?? this.recordedAt,
      memo: memo ?? this.memo,
      sleepHours: sleepHours ?? this.sleepHours,
      conditionScore: conditionScore ?? this.conditionScore,
      weatherLabel: weatherLabel ?? this.weatherLabel,
      weatherTemp: weatherTemp ?? this.weatherTemp,
      createdAt: createdAt ?? this.createdAt,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (contextId.present) {
      map['context_id'] = Variable<String>(contextId.value);
    }
    if (userId.present) {
      map['user_id'] = Variable<String>(userId.value);
    }
    if (recordedAt.present) {
      map['recorded_at'] = Variable<DateTime>(recordedAt.value);
    }
    if (memo.present) {
      map['memo'] = Variable<String>(memo.value);
    }
    if (sleepHours.present) {
      map['sleep_hours'] = Variable<double>(sleepHours.value);
    }
    if (conditionScore.present) {
      map['condition_score'] = Variable<int>(conditionScore.value);
    }
    if (weatherLabel.present) {
      map['weather_label'] = Variable<String>(weatherLabel.value);
    }
    if (weatherTemp.present) {
      map['weather_temp'] = Variable<double>(weatherTemp.value);
    }
    if (createdAt.present) {
      map['created_at'] = Variable<DateTime>(createdAt.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('DailyContextsCompanion(')
          ..write('contextId: $contextId, ')
          ..write('userId: $userId, ')
          ..write('recordedAt: $recordedAt, ')
          ..write('memo: $memo, ')
          ..write('sleepHours: $sleepHours, ')
          ..write('conditionScore: $conditionScore, ')
          ..write('weatherLabel: $weatherLabel, ')
          ..write('weatherTemp: $weatherTemp, ')
          ..write('createdAt: $createdAt, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $MedicationRecordsTable extends MedicationRecords
    with TableInfo<$MedicationRecordsTable, MedicationRecord> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $MedicationRecordsTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _medicationIdMeta = const VerificationMeta(
    'medicationId',
  );
  @override
  late final GeneratedColumn<String> medicationId = GeneratedColumn<String>(
    'medication_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _userIdMeta = const VerificationMeta('userId');
  @override
  late final GeneratedColumn<String> userId = GeneratedColumn<String>(
    'user_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _takenAtMeta = const VerificationMeta(
    'takenAt',
  );
  @override
  late final GeneratedColumn<DateTime> takenAt = GeneratedColumn<DateTime>(
    'taken_at',
    aliasedName,
    false,
    type: DriftSqlType.dateTime,
    requiredDuringInsert: false,
    defaultValue: currentDateAndTime,
  );
  static const VerificationMeta _nameMeta = const VerificationMeta('name');
  @override
  late final GeneratedColumn<String> name = GeneratedColumn<String>(
    'name',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _dosageMeta = const VerificationMeta('dosage');
  @override
  late final GeneratedColumn<String> dosage = GeneratedColumn<String>(
    'dosage',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _memoMeta = const VerificationMeta('memo');
  @override
  late final GeneratedColumn<String> memo = GeneratedColumn<String>(
    'memo',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _isPrescriptionMeta = const VerificationMeta(
    'isPrescription',
  );
  @override
  late final GeneratedColumn<bool> isPrescription = GeneratedColumn<bool>(
    'is_prescription',
    aliasedName,
    false,
    type: DriftSqlType.bool,
    requiredDuringInsert: false,
    defaultConstraints: GeneratedColumn.constraintIsAlways(
      'CHECK ("is_prescription" IN (0, 1))',
    ),
    defaultValue: const Constant(false),
  );
  static const VerificationMeta _createdAtMeta = const VerificationMeta(
    'createdAt',
  );
  @override
  late final GeneratedColumn<DateTime> createdAt = GeneratedColumn<DateTime>(
    'created_at',
    aliasedName,
    false,
    type: DriftSqlType.dateTime,
    requiredDuringInsert: false,
    defaultValue: currentDateAndTime,
  );
  @override
  List<GeneratedColumn> get $columns => [
    medicationId,
    userId,
    takenAt,
    name,
    dosage,
    memo,
    isPrescription,
    createdAt,
  ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'medication_records';
  @override
  VerificationContext validateIntegrity(
    Insertable<MedicationRecord> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('medication_id')) {
      context.handle(
        _medicationIdMeta,
        medicationId.isAcceptableOrUnknown(
          data['medication_id']!,
          _medicationIdMeta,
        ),
      );
    } else if (isInserting) {
      context.missing(_medicationIdMeta);
    }
    if (data.containsKey('user_id')) {
      context.handle(
        _userIdMeta,
        userId.isAcceptableOrUnknown(data['user_id']!, _userIdMeta),
      );
    } else if (isInserting) {
      context.missing(_userIdMeta);
    }
    if (data.containsKey('taken_at')) {
      context.handle(
        _takenAtMeta,
        takenAt.isAcceptableOrUnknown(data['taken_at']!, _takenAtMeta),
      );
    }
    if (data.containsKey('name')) {
      context.handle(
        _nameMeta,
        name.isAcceptableOrUnknown(data['name']!, _nameMeta),
      );
    } else if (isInserting) {
      context.missing(_nameMeta);
    }
    if (data.containsKey('dosage')) {
      context.handle(
        _dosageMeta,
        dosage.isAcceptableOrUnknown(data['dosage']!, _dosageMeta),
      );
    }
    if (data.containsKey('memo')) {
      context.handle(
        _memoMeta,
        memo.isAcceptableOrUnknown(data['memo']!, _memoMeta),
      );
    }
    if (data.containsKey('is_prescription')) {
      context.handle(
        _isPrescriptionMeta,
        isPrescription.isAcceptableOrUnknown(
          data['is_prescription']!,
          _isPrescriptionMeta,
        ),
      );
    }
    if (data.containsKey('created_at')) {
      context.handle(
        _createdAtMeta,
        createdAt.isAcceptableOrUnknown(data['created_at']!, _createdAtMeta),
      );
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {medicationId};
  @override
  MedicationRecord map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return MedicationRecord(
      medicationId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}medication_id'],
      )!,
      userId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}user_id'],
      )!,
      takenAt: attachedDatabase.typeMapping.read(
        DriftSqlType.dateTime,
        data['${effectivePrefix}taken_at'],
      )!,
      name: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}name'],
      )!,
      dosage: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}dosage'],
      ),
      memo: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}memo'],
      ),
      isPrescription: attachedDatabase.typeMapping.read(
        DriftSqlType.bool,
        data['${effectivePrefix}is_prescription'],
      )!,
      createdAt: attachedDatabase.typeMapping.read(
        DriftSqlType.dateTime,
        data['${effectivePrefix}created_at'],
      )!,
    );
  }

  @override
  $MedicationRecordsTable createAlias(String alias) {
    return $MedicationRecordsTable(attachedDatabase, alias);
  }
}

class MedicationRecord extends DataClass
    implements Insertable<MedicationRecord> {
  final String medicationId;
  final String userId;
  final DateTime takenAt;
  final String name;
  final String? dosage;
  final String? memo;
  final bool isPrescription;
  final DateTime createdAt;
  const MedicationRecord({
    required this.medicationId,
    required this.userId,
    required this.takenAt,
    required this.name,
    this.dosage,
    this.memo,
    required this.isPrescription,
    required this.createdAt,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['medication_id'] = Variable<String>(medicationId);
    map['user_id'] = Variable<String>(userId);
    map['taken_at'] = Variable<DateTime>(takenAt);
    map['name'] = Variable<String>(name);
    if (!nullToAbsent || dosage != null) {
      map['dosage'] = Variable<String>(dosage);
    }
    if (!nullToAbsent || memo != null) {
      map['memo'] = Variable<String>(memo);
    }
    map['is_prescription'] = Variable<bool>(isPrescription);
    map['created_at'] = Variable<DateTime>(createdAt);
    return map;
  }

  MedicationRecordsCompanion toCompanion(bool nullToAbsent) {
    return MedicationRecordsCompanion(
      medicationId: Value(medicationId),
      userId: Value(userId),
      takenAt: Value(takenAt),
      name: Value(name),
      dosage: dosage == null && nullToAbsent
          ? const Value.absent()
          : Value(dosage),
      memo: memo == null && nullToAbsent ? const Value.absent() : Value(memo),
      isPrescription: Value(isPrescription),
      createdAt: Value(createdAt),
    );
  }

  factory MedicationRecord.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return MedicationRecord(
      medicationId: serializer.fromJson<String>(json['medicationId']),
      userId: serializer.fromJson<String>(json['userId']),
      takenAt: serializer.fromJson<DateTime>(json['takenAt']),
      name: serializer.fromJson<String>(json['name']),
      dosage: serializer.fromJson<String?>(json['dosage']),
      memo: serializer.fromJson<String?>(json['memo']),
      isPrescription: serializer.fromJson<bool>(json['isPrescription']),
      createdAt: serializer.fromJson<DateTime>(json['createdAt']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'medicationId': serializer.toJson<String>(medicationId),
      'userId': serializer.toJson<String>(userId),
      'takenAt': serializer.toJson<DateTime>(takenAt),
      'name': serializer.toJson<String>(name),
      'dosage': serializer.toJson<String?>(dosage),
      'memo': serializer.toJson<String?>(memo),
      'isPrescription': serializer.toJson<bool>(isPrescription),
      'createdAt': serializer.toJson<DateTime>(createdAt),
    };
  }

  MedicationRecord copyWith({
    String? medicationId,
    String? userId,
    DateTime? takenAt,
    String? name,
    Value<String?> dosage = const Value.absent(),
    Value<String?> memo = const Value.absent(),
    bool? isPrescription,
    DateTime? createdAt,
  }) => MedicationRecord(
    medicationId: medicationId ?? this.medicationId,
    userId: userId ?? this.userId,
    takenAt: takenAt ?? this.takenAt,
    name: name ?? this.name,
    dosage: dosage.present ? dosage.value : this.dosage,
    memo: memo.present ? memo.value : this.memo,
    isPrescription: isPrescription ?? this.isPrescription,
    createdAt: createdAt ?? this.createdAt,
  );
  MedicationRecord copyWithCompanion(MedicationRecordsCompanion data) {
    return MedicationRecord(
      medicationId: data.medicationId.present
          ? data.medicationId.value
          : this.medicationId,
      userId: data.userId.present ? data.userId.value : this.userId,
      takenAt: data.takenAt.present ? data.takenAt.value : this.takenAt,
      name: data.name.present ? data.name.value : this.name,
      dosage: data.dosage.present ? data.dosage.value : this.dosage,
      memo: data.memo.present ? data.memo.value : this.memo,
      isPrescription: data.isPrescription.present
          ? data.isPrescription.value
          : this.isPrescription,
      createdAt: data.createdAt.present ? data.createdAt.value : this.createdAt,
    );
  }

  @override
  String toString() {
    return (StringBuffer('MedicationRecord(')
          ..write('medicationId: $medicationId, ')
          ..write('userId: $userId, ')
          ..write('takenAt: $takenAt, ')
          ..write('name: $name, ')
          ..write('dosage: $dosage, ')
          ..write('memo: $memo, ')
          ..write('isPrescription: $isPrescription, ')
          ..write('createdAt: $createdAt')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(
    medicationId,
    userId,
    takenAt,
    name,
    dosage,
    memo,
    isPrescription,
    createdAt,
  );
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is MedicationRecord &&
          other.medicationId == this.medicationId &&
          other.userId == this.userId &&
          other.takenAt == this.takenAt &&
          other.name == this.name &&
          other.dosage == this.dosage &&
          other.memo == this.memo &&
          other.isPrescription == this.isPrescription &&
          other.createdAt == this.createdAt);
}

class MedicationRecordsCompanion extends UpdateCompanion<MedicationRecord> {
  final Value<String> medicationId;
  final Value<String> userId;
  final Value<DateTime> takenAt;
  final Value<String> name;
  final Value<String?> dosage;
  final Value<String?> memo;
  final Value<bool> isPrescription;
  final Value<DateTime> createdAt;
  final Value<int> rowid;
  const MedicationRecordsCompanion({
    this.medicationId = const Value.absent(),
    this.userId = const Value.absent(),
    this.takenAt = const Value.absent(),
    this.name = const Value.absent(),
    this.dosage = const Value.absent(),
    this.memo = const Value.absent(),
    this.isPrescription = const Value.absent(),
    this.createdAt = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  MedicationRecordsCompanion.insert({
    required String medicationId,
    required String userId,
    this.takenAt = const Value.absent(),
    required String name,
    this.dosage = const Value.absent(),
    this.memo = const Value.absent(),
    this.isPrescription = const Value.absent(),
    this.createdAt = const Value.absent(),
    this.rowid = const Value.absent(),
  }) : medicationId = Value(medicationId),
       userId = Value(userId),
       name = Value(name);
  static Insertable<MedicationRecord> custom({
    Expression<String>? medicationId,
    Expression<String>? userId,
    Expression<DateTime>? takenAt,
    Expression<String>? name,
    Expression<String>? dosage,
    Expression<String>? memo,
    Expression<bool>? isPrescription,
    Expression<DateTime>? createdAt,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (medicationId != null) 'medication_id': medicationId,
      if (userId != null) 'user_id': userId,
      if (takenAt != null) 'taken_at': takenAt,
      if (name != null) 'name': name,
      if (dosage != null) 'dosage': dosage,
      if (memo != null) 'memo': memo,
      if (isPrescription != null) 'is_prescription': isPrescription,
      if (createdAt != null) 'created_at': createdAt,
      if (rowid != null) 'rowid': rowid,
    });
  }

  MedicationRecordsCompanion copyWith({
    Value<String>? medicationId,
    Value<String>? userId,
    Value<DateTime>? takenAt,
    Value<String>? name,
    Value<String?>? dosage,
    Value<String?>? memo,
    Value<bool>? isPrescription,
    Value<DateTime>? createdAt,
    Value<int>? rowid,
  }) {
    return MedicationRecordsCompanion(
      medicationId: medicationId ?? this.medicationId,
      userId: userId ?? this.userId,
      takenAt: takenAt ?? this.takenAt,
      name: name ?? this.name,
      dosage: dosage ?? this.dosage,
      memo: memo ?? this.memo,
      isPrescription: isPrescription ?? this.isPrescription,
      createdAt: createdAt ?? this.createdAt,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (medicationId.present) {
      map['medication_id'] = Variable<String>(medicationId.value);
    }
    if (userId.present) {
      map['user_id'] = Variable<String>(userId.value);
    }
    if (takenAt.present) {
      map['taken_at'] = Variable<DateTime>(takenAt.value);
    }
    if (name.present) {
      map['name'] = Variable<String>(name.value);
    }
    if (dosage.present) {
      map['dosage'] = Variable<String>(dosage.value);
    }
    if (memo.present) {
      map['memo'] = Variable<String>(memo.value);
    }
    if (isPrescription.present) {
      map['is_prescription'] = Variable<bool>(isPrescription.value);
    }
    if (createdAt.present) {
      map['created_at'] = Variable<DateTime>(createdAt.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('MedicationRecordsCompanion(')
          ..write('medicationId: $medicationId, ')
          ..write('userId: $userId, ')
          ..write('takenAt: $takenAt, ')
          ..write('name: $name, ')
          ..write('dosage: $dosage, ')
          ..write('memo: $memo, ')
          ..write('isPrescription: $isPrescription, ')
          ..write('createdAt: $createdAt, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $ExerciseRecordsTable extends ExerciseRecords
    with TableInfo<$ExerciseRecordsTable, ExerciseRecord> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $ExerciseRecordsTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _exerciseIdMeta = const VerificationMeta(
    'exerciseId',
  );
  @override
  late final GeneratedColumn<String> exerciseId = GeneratedColumn<String>(
    'exercise_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _userIdMeta = const VerificationMeta('userId');
  @override
  late final GeneratedColumn<String> userId = GeneratedColumn<String>(
    'user_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _startedAtMeta = const VerificationMeta(
    'startedAt',
  );
  @override
  late final GeneratedColumn<DateTime> startedAt = GeneratedColumn<DateTime>(
    'started_at',
    aliasedName,
    false,
    type: DriftSqlType.dateTime,
    requiredDuringInsert: false,
    defaultValue: currentDateAndTime,
  );
  static const VerificationMeta _endedAtMeta = const VerificationMeta(
    'endedAt',
  );
  @override
  late final GeneratedColumn<DateTime> endedAt = GeneratedColumn<DateTime>(
    'ended_at',
    aliasedName,
    true,
    type: DriftSqlType.dateTime,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _exerciseTypeMeta = const VerificationMeta(
    'exerciseType',
  );
  @override
  late final GeneratedColumn<String> exerciseType = GeneratedColumn<String>(
    'exercise_type',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _durationMinutesMeta = const VerificationMeta(
    'durationMinutes',
  );
  @override
  late final GeneratedColumn<int> durationMinutes = GeneratedColumn<int>(
    'duration_minutes',
    aliasedName,
    true,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _intensityMeta = const VerificationMeta(
    'intensity',
  );
  @override
  late final GeneratedColumn<String> intensity = GeneratedColumn<String>(
    'intensity',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _locationLabelMeta = const VerificationMeta(
    'locationLabel',
  );
  @override
  late final GeneratedColumn<String> locationLabel = GeneratedColumn<String>(
    'location_label',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _memoMeta = const VerificationMeta('memo');
  @override
  late final GeneratedColumn<String> memo = GeneratedColumn<String>(
    'memo',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _estimatedCaloriesMeta = const VerificationMeta(
    'estimatedCalories',
  );
  @override
  late final GeneratedColumn<int> estimatedCalories = GeneratedColumn<int>(
    'estimated_calories',
    aliasedName,
    true,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _createdAtMeta = const VerificationMeta(
    'createdAt',
  );
  @override
  late final GeneratedColumn<DateTime> createdAt = GeneratedColumn<DateTime>(
    'created_at',
    aliasedName,
    false,
    type: DriftSqlType.dateTime,
    requiredDuringInsert: false,
    defaultValue: currentDateAndTime,
  );
  @override
  List<GeneratedColumn> get $columns => [
    exerciseId,
    userId,
    startedAt,
    endedAt,
    exerciseType,
    durationMinutes,
    intensity,
    locationLabel,
    memo,
    estimatedCalories,
    createdAt,
  ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'exercise_records';
  @override
  VerificationContext validateIntegrity(
    Insertable<ExerciseRecord> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('exercise_id')) {
      context.handle(
        _exerciseIdMeta,
        exerciseId.isAcceptableOrUnknown(data['exercise_id']!, _exerciseIdMeta),
      );
    } else if (isInserting) {
      context.missing(_exerciseIdMeta);
    }
    if (data.containsKey('user_id')) {
      context.handle(
        _userIdMeta,
        userId.isAcceptableOrUnknown(data['user_id']!, _userIdMeta),
      );
    } else if (isInserting) {
      context.missing(_userIdMeta);
    }
    if (data.containsKey('started_at')) {
      context.handle(
        _startedAtMeta,
        startedAt.isAcceptableOrUnknown(data['started_at']!, _startedAtMeta),
      );
    }
    if (data.containsKey('ended_at')) {
      context.handle(
        _endedAtMeta,
        endedAt.isAcceptableOrUnknown(data['ended_at']!, _endedAtMeta),
      );
    }
    if (data.containsKey('exercise_type')) {
      context.handle(
        _exerciseTypeMeta,
        exerciseType.isAcceptableOrUnknown(
          data['exercise_type']!,
          _exerciseTypeMeta,
        ),
      );
    } else if (isInserting) {
      context.missing(_exerciseTypeMeta);
    }
    if (data.containsKey('duration_minutes')) {
      context.handle(
        _durationMinutesMeta,
        durationMinutes.isAcceptableOrUnknown(
          data['duration_minutes']!,
          _durationMinutesMeta,
        ),
      );
    }
    if (data.containsKey('intensity')) {
      context.handle(
        _intensityMeta,
        intensity.isAcceptableOrUnknown(data['intensity']!, _intensityMeta),
      );
    }
    if (data.containsKey('location_label')) {
      context.handle(
        _locationLabelMeta,
        locationLabel.isAcceptableOrUnknown(
          data['location_label']!,
          _locationLabelMeta,
        ),
      );
    }
    if (data.containsKey('memo')) {
      context.handle(
        _memoMeta,
        memo.isAcceptableOrUnknown(data['memo']!, _memoMeta),
      );
    }
    if (data.containsKey('estimated_calories')) {
      context.handle(
        _estimatedCaloriesMeta,
        estimatedCalories.isAcceptableOrUnknown(
          data['estimated_calories']!,
          _estimatedCaloriesMeta,
        ),
      );
    }
    if (data.containsKey('created_at')) {
      context.handle(
        _createdAtMeta,
        createdAt.isAcceptableOrUnknown(data['created_at']!, _createdAtMeta),
      );
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {exerciseId};
  @override
  ExerciseRecord map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return ExerciseRecord(
      exerciseId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}exercise_id'],
      )!,
      userId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}user_id'],
      )!,
      startedAt: attachedDatabase.typeMapping.read(
        DriftSqlType.dateTime,
        data['${effectivePrefix}started_at'],
      )!,
      endedAt: attachedDatabase.typeMapping.read(
        DriftSqlType.dateTime,
        data['${effectivePrefix}ended_at'],
      ),
      exerciseType: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}exercise_type'],
      )!,
      durationMinutes: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}duration_minutes'],
      ),
      intensity: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}intensity'],
      ),
      locationLabel: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}location_label'],
      ),
      memo: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}memo'],
      ),
      estimatedCalories: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}estimated_calories'],
      ),
      createdAt: attachedDatabase.typeMapping.read(
        DriftSqlType.dateTime,
        data['${effectivePrefix}created_at'],
      )!,
    );
  }

  @override
  $ExerciseRecordsTable createAlias(String alias) {
    return $ExerciseRecordsTable(attachedDatabase, alias);
  }
}

class ExerciseRecord extends DataClass implements Insertable<ExerciseRecord> {
  final String exerciseId;
  final String userId;
  final DateTime startedAt;
  final DateTime? endedAt;
  final String exerciseType;
  final int? durationMinutes;
  final String? intensity;
  final String? locationLabel;
  final String? memo;
  final int? estimatedCalories;
  final DateTime createdAt;
  const ExerciseRecord({
    required this.exerciseId,
    required this.userId,
    required this.startedAt,
    this.endedAt,
    required this.exerciseType,
    this.durationMinutes,
    this.intensity,
    this.locationLabel,
    this.memo,
    this.estimatedCalories,
    required this.createdAt,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['exercise_id'] = Variable<String>(exerciseId);
    map['user_id'] = Variable<String>(userId);
    map['started_at'] = Variable<DateTime>(startedAt);
    if (!nullToAbsent || endedAt != null) {
      map['ended_at'] = Variable<DateTime>(endedAt);
    }
    map['exercise_type'] = Variable<String>(exerciseType);
    if (!nullToAbsent || durationMinutes != null) {
      map['duration_minutes'] = Variable<int>(durationMinutes);
    }
    if (!nullToAbsent || intensity != null) {
      map['intensity'] = Variable<String>(intensity);
    }
    if (!nullToAbsent || locationLabel != null) {
      map['location_label'] = Variable<String>(locationLabel);
    }
    if (!nullToAbsent || memo != null) {
      map['memo'] = Variable<String>(memo);
    }
    if (!nullToAbsent || estimatedCalories != null) {
      map['estimated_calories'] = Variable<int>(estimatedCalories);
    }
    map['created_at'] = Variable<DateTime>(createdAt);
    return map;
  }

  ExerciseRecordsCompanion toCompanion(bool nullToAbsent) {
    return ExerciseRecordsCompanion(
      exerciseId: Value(exerciseId),
      userId: Value(userId),
      startedAt: Value(startedAt),
      endedAt: endedAt == null && nullToAbsent
          ? const Value.absent()
          : Value(endedAt),
      exerciseType: Value(exerciseType),
      durationMinutes: durationMinutes == null && nullToAbsent
          ? const Value.absent()
          : Value(durationMinutes),
      intensity: intensity == null && nullToAbsent
          ? const Value.absent()
          : Value(intensity),
      locationLabel: locationLabel == null && nullToAbsent
          ? const Value.absent()
          : Value(locationLabel),
      memo: memo == null && nullToAbsent ? const Value.absent() : Value(memo),
      estimatedCalories: estimatedCalories == null && nullToAbsent
          ? const Value.absent()
          : Value(estimatedCalories),
      createdAt: Value(createdAt),
    );
  }

  factory ExerciseRecord.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return ExerciseRecord(
      exerciseId: serializer.fromJson<String>(json['exerciseId']),
      userId: serializer.fromJson<String>(json['userId']),
      startedAt: serializer.fromJson<DateTime>(json['startedAt']),
      endedAt: serializer.fromJson<DateTime?>(json['endedAt']),
      exerciseType: serializer.fromJson<String>(json['exerciseType']),
      durationMinutes: serializer.fromJson<int?>(json['durationMinutes']),
      intensity: serializer.fromJson<String?>(json['intensity']),
      locationLabel: serializer.fromJson<String?>(json['locationLabel']),
      memo: serializer.fromJson<String?>(json['memo']),
      estimatedCalories: serializer.fromJson<int?>(json['estimatedCalories']),
      createdAt: serializer.fromJson<DateTime>(json['createdAt']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'exerciseId': serializer.toJson<String>(exerciseId),
      'userId': serializer.toJson<String>(userId),
      'startedAt': serializer.toJson<DateTime>(startedAt),
      'endedAt': serializer.toJson<DateTime?>(endedAt),
      'exerciseType': serializer.toJson<String>(exerciseType),
      'durationMinutes': serializer.toJson<int?>(durationMinutes),
      'intensity': serializer.toJson<String?>(intensity),
      'locationLabel': serializer.toJson<String?>(locationLabel),
      'memo': serializer.toJson<String?>(memo),
      'estimatedCalories': serializer.toJson<int?>(estimatedCalories),
      'createdAt': serializer.toJson<DateTime>(createdAt),
    };
  }

  ExerciseRecord copyWith({
    String? exerciseId,
    String? userId,
    DateTime? startedAt,
    Value<DateTime?> endedAt = const Value.absent(),
    String? exerciseType,
    Value<int?> durationMinutes = const Value.absent(),
    Value<String?> intensity = const Value.absent(),
    Value<String?> locationLabel = const Value.absent(),
    Value<String?> memo = const Value.absent(),
    Value<int?> estimatedCalories = const Value.absent(),
    DateTime? createdAt,
  }) => ExerciseRecord(
    exerciseId: exerciseId ?? this.exerciseId,
    userId: userId ?? this.userId,
    startedAt: startedAt ?? this.startedAt,
    endedAt: endedAt.present ? endedAt.value : this.endedAt,
    exerciseType: exerciseType ?? this.exerciseType,
    durationMinutes: durationMinutes.present
        ? durationMinutes.value
        : this.durationMinutes,
    intensity: intensity.present ? intensity.value : this.intensity,
    locationLabel: locationLabel.present
        ? locationLabel.value
        : this.locationLabel,
    memo: memo.present ? memo.value : this.memo,
    estimatedCalories: estimatedCalories.present
        ? estimatedCalories.value
        : this.estimatedCalories,
    createdAt: createdAt ?? this.createdAt,
  );
  ExerciseRecord copyWithCompanion(ExerciseRecordsCompanion data) {
    return ExerciseRecord(
      exerciseId: data.exerciseId.present
          ? data.exerciseId.value
          : this.exerciseId,
      userId: data.userId.present ? data.userId.value : this.userId,
      startedAt: data.startedAt.present ? data.startedAt.value : this.startedAt,
      endedAt: data.endedAt.present ? data.endedAt.value : this.endedAt,
      exerciseType: data.exerciseType.present
          ? data.exerciseType.value
          : this.exerciseType,
      durationMinutes: data.durationMinutes.present
          ? data.durationMinutes.value
          : this.durationMinutes,
      intensity: data.intensity.present ? data.intensity.value : this.intensity,
      locationLabel: data.locationLabel.present
          ? data.locationLabel.value
          : this.locationLabel,
      memo: data.memo.present ? data.memo.value : this.memo,
      estimatedCalories: data.estimatedCalories.present
          ? data.estimatedCalories.value
          : this.estimatedCalories,
      createdAt: data.createdAt.present ? data.createdAt.value : this.createdAt,
    );
  }

  @override
  String toString() {
    return (StringBuffer('ExerciseRecord(')
          ..write('exerciseId: $exerciseId, ')
          ..write('userId: $userId, ')
          ..write('startedAt: $startedAt, ')
          ..write('endedAt: $endedAt, ')
          ..write('exerciseType: $exerciseType, ')
          ..write('durationMinutes: $durationMinutes, ')
          ..write('intensity: $intensity, ')
          ..write('locationLabel: $locationLabel, ')
          ..write('memo: $memo, ')
          ..write('estimatedCalories: $estimatedCalories, ')
          ..write('createdAt: $createdAt')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(
    exerciseId,
    userId,
    startedAt,
    endedAt,
    exerciseType,
    durationMinutes,
    intensity,
    locationLabel,
    memo,
    estimatedCalories,
    createdAt,
  );
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is ExerciseRecord &&
          other.exerciseId == this.exerciseId &&
          other.userId == this.userId &&
          other.startedAt == this.startedAt &&
          other.endedAt == this.endedAt &&
          other.exerciseType == this.exerciseType &&
          other.durationMinutes == this.durationMinutes &&
          other.intensity == this.intensity &&
          other.locationLabel == this.locationLabel &&
          other.memo == this.memo &&
          other.estimatedCalories == this.estimatedCalories &&
          other.createdAt == this.createdAt);
}

class ExerciseRecordsCompanion extends UpdateCompanion<ExerciseRecord> {
  final Value<String> exerciseId;
  final Value<String> userId;
  final Value<DateTime> startedAt;
  final Value<DateTime?> endedAt;
  final Value<String> exerciseType;
  final Value<int?> durationMinutes;
  final Value<String?> intensity;
  final Value<String?> locationLabel;
  final Value<String?> memo;
  final Value<int?> estimatedCalories;
  final Value<DateTime> createdAt;
  final Value<int> rowid;
  const ExerciseRecordsCompanion({
    this.exerciseId = const Value.absent(),
    this.userId = const Value.absent(),
    this.startedAt = const Value.absent(),
    this.endedAt = const Value.absent(),
    this.exerciseType = const Value.absent(),
    this.durationMinutes = const Value.absent(),
    this.intensity = const Value.absent(),
    this.locationLabel = const Value.absent(),
    this.memo = const Value.absent(),
    this.estimatedCalories = const Value.absent(),
    this.createdAt = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  ExerciseRecordsCompanion.insert({
    required String exerciseId,
    required String userId,
    this.startedAt = const Value.absent(),
    this.endedAt = const Value.absent(),
    required String exerciseType,
    this.durationMinutes = const Value.absent(),
    this.intensity = const Value.absent(),
    this.locationLabel = const Value.absent(),
    this.memo = const Value.absent(),
    this.estimatedCalories = const Value.absent(),
    this.createdAt = const Value.absent(),
    this.rowid = const Value.absent(),
  }) : exerciseId = Value(exerciseId),
       userId = Value(userId),
       exerciseType = Value(exerciseType);
  static Insertable<ExerciseRecord> custom({
    Expression<String>? exerciseId,
    Expression<String>? userId,
    Expression<DateTime>? startedAt,
    Expression<DateTime>? endedAt,
    Expression<String>? exerciseType,
    Expression<int>? durationMinutes,
    Expression<String>? intensity,
    Expression<String>? locationLabel,
    Expression<String>? memo,
    Expression<int>? estimatedCalories,
    Expression<DateTime>? createdAt,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (exerciseId != null) 'exercise_id': exerciseId,
      if (userId != null) 'user_id': userId,
      if (startedAt != null) 'started_at': startedAt,
      if (endedAt != null) 'ended_at': endedAt,
      if (exerciseType != null) 'exercise_type': exerciseType,
      if (durationMinutes != null) 'duration_minutes': durationMinutes,
      if (intensity != null) 'intensity': intensity,
      if (locationLabel != null) 'location_label': locationLabel,
      if (memo != null) 'memo': memo,
      if (estimatedCalories != null) 'estimated_calories': estimatedCalories,
      if (createdAt != null) 'created_at': createdAt,
      if (rowid != null) 'rowid': rowid,
    });
  }

  ExerciseRecordsCompanion copyWith({
    Value<String>? exerciseId,
    Value<String>? userId,
    Value<DateTime>? startedAt,
    Value<DateTime?>? endedAt,
    Value<String>? exerciseType,
    Value<int?>? durationMinutes,
    Value<String?>? intensity,
    Value<String?>? locationLabel,
    Value<String?>? memo,
    Value<int?>? estimatedCalories,
    Value<DateTime>? createdAt,
    Value<int>? rowid,
  }) {
    return ExerciseRecordsCompanion(
      exerciseId: exerciseId ?? this.exerciseId,
      userId: userId ?? this.userId,
      startedAt: startedAt ?? this.startedAt,
      endedAt: endedAt ?? this.endedAt,
      exerciseType: exerciseType ?? this.exerciseType,
      durationMinutes: durationMinutes ?? this.durationMinutes,
      intensity: intensity ?? this.intensity,
      locationLabel: locationLabel ?? this.locationLabel,
      memo: memo ?? this.memo,
      estimatedCalories: estimatedCalories ?? this.estimatedCalories,
      createdAt: createdAt ?? this.createdAt,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (exerciseId.present) {
      map['exercise_id'] = Variable<String>(exerciseId.value);
    }
    if (userId.present) {
      map['user_id'] = Variable<String>(userId.value);
    }
    if (startedAt.present) {
      map['started_at'] = Variable<DateTime>(startedAt.value);
    }
    if (endedAt.present) {
      map['ended_at'] = Variable<DateTime>(endedAt.value);
    }
    if (exerciseType.present) {
      map['exercise_type'] = Variable<String>(exerciseType.value);
    }
    if (durationMinutes.present) {
      map['duration_minutes'] = Variable<int>(durationMinutes.value);
    }
    if (intensity.present) {
      map['intensity'] = Variable<String>(intensity.value);
    }
    if (locationLabel.present) {
      map['location_label'] = Variable<String>(locationLabel.value);
    }
    if (memo.present) {
      map['memo'] = Variable<String>(memo.value);
    }
    if (estimatedCalories.present) {
      map['estimated_calories'] = Variable<int>(estimatedCalories.value);
    }
    if (createdAt.present) {
      map['created_at'] = Variable<DateTime>(createdAt.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('ExerciseRecordsCompanion(')
          ..write('exerciseId: $exerciseId, ')
          ..write('userId: $userId, ')
          ..write('startedAt: $startedAt, ')
          ..write('endedAt: $endedAt, ')
          ..write('exerciseType: $exerciseType, ')
          ..write('durationMinutes: $durationMinutes, ')
          ..write('intensity: $intensity, ')
          ..write('locationLabel: $locationLabel, ')
          ..write('memo: $memo, ')
          ..write('estimatedCalories: $estimatedCalories, ')
          ..write('createdAt: $createdAt, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $HospitalRecordsTable extends HospitalRecords
    with TableInfo<$HospitalRecordsTable, HospitalRecord> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $HospitalRecordsTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _hospitalIdMeta = const VerificationMeta(
    'hospitalId',
  );
  @override
  late final GeneratedColumn<String> hospitalId = GeneratedColumn<String>(
    'hospital_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _userIdMeta = const VerificationMeta('userId');
  @override
  late final GeneratedColumn<String> userId = GeneratedColumn<String>(
    'user_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _visitedAtMeta = const VerificationMeta(
    'visitedAt',
  );
  @override
  late final GeneratedColumn<DateTime> visitedAt = GeneratedColumn<DateTime>(
    'visited_at',
    aliasedName,
    false,
    type: DriftSqlType.dateTime,
    requiredDuringInsert: false,
    defaultValue: currentDateAndTime,
  );
  static const VerificationMeta _hospitalNameMeta = const VerificationMeta(
    'hospitalName',
  );
  @override
  late final GeneratedColumn<String> hospitalName = GeneratedColumn<String>(
    'hospital_name',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _departmentMeta = const VerificationMeta(
    'department',
  );
  @override
  late final GeneratedColumn<String> department = GeneratedColumn<String>(
    'department',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _reasonMeta = const VerificationMeta('reason');
  @override
  late final GeneratedColumn<String> reason = GeneratedColumn<String>(
    'reason',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _diagnosisMeta = const VerificationMeta(
    'diagnosis',
  );
  @override
  late final GeneratedColumn<String> diagnosis = GeneratedColumn<String>(
    'diagnosis',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _memoMeta = const VerificationMeta('memo');
  @override
  late final GeneratedColumn<String> memo = GeneratedColumn<String>(
    'memo',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _amountMeta = const VerificationMeta('amount');
  @override
  late final GeneratedColumn<int> amount = GeneratedColumn<int>(
    'amount',
    aliasedName,
    true,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _createdAtMeta = const VerificationMeta(
    'createdAt',
  );
  @override
  late final GeneratedColumn<DateTime> createdAt = GeneratedColumn<DateTime>(
    'created_at',
    aliasedName,
    false,
    type: DriftSqlType.dateTime,
    requiredDuringInsert: false,
    defaultValue: currentDateAndTime,
  );
  @override
  List<GeneratedColumn> get $columns => [
    hospitalId,
    userId,
    visitedAt,
    hospitalName,
    department,
    reason,
    diagnosis,
    memo,
    amount,
    createdAt,
  ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'hospital_records';
  @override
  VerificationContext validateIntegrity(
    Insertable<HospitalRecord> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('hospital_id')) {
      context.handle(
        _hospitalIdMeta,
        hospitalId.isAcceptableOrUnknown(data['hospital_id']!, _hospitalIdMeta),
      );
    } else if (isInserting) {
      context.missing(_hospitalIdMeta);
    }
    if (data.containsKey('user_id')) {
      context.handle(
        _userIdMeta,
        userId.isAcceptableOrUnknown(data['user_id']!, _userIdMeta),
      );
    } else if (isInserting) {
      context.missing(_userIdMeta);
    }
    if (data.containsKey('visited_at')) {
      context.handle(
        _visitedAtMeta,
        visitedAt.isAcceptableOrUnknown(data['visited_at']!, _visitedAtMeta),
      );
    }
    if (data.containsKey('hospital_name')) {
      context.handle(
        _hospitalNameMeta,
        hospitalName.isAcceptableOrUnknown(
          data['hospital_name']!,
          _hospitalNameMeta,
        ),
      );
    } else if (isInserting) {
      context.missing(_hospitalNameMeta);
    }
    if (data.containsKey('department')) {
      context.handle(
        _departmentMeta,
        department.isAcceptableOrUnknown(data['department']!, _departmentMeta),
      );
    }
    if (data.containsKey('reason')) {
      context.handle(
        _reasonMeta,
        reason.isAcceptableOrUnknown(data['reason']!, _reasonMeta),
      );
    }
    if (data.containsKey('diagnosis')) {
      context.handle(
        _diagnosisMeta,
        diagnosis.isAcceptableOrUnknown(data['diagnosis']!, _diagnosisMeta),
      );
    }
    if (data.containsKey('memo')) {
      context.handle(
        _memoMeta,
        memo.isAcceptableOrUnknown(data['memo']!, _memoMeta),
      );
    }
    if (data.containsKey('amount')) {
      context.handle(
        _amountMeta,
        amount.isAcceptableOrUnknown(data['amount']!, _amountMeta),
      );
    }
    if (data.containsKey('created_at')) {
      context.handle(
        _createdAtMeta,
        createdAt.isAcceptableOrUnknown(data['created_at']!, _createdAtMeta),
      );
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {hospitalId};
  @override
  HospitalRecord map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return HospitalRecord(
      hospitalId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}hospital_id'],
      )!,
      userId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}user_id'],
      )!,
      visitedAt: attachedDatabase.typeMapping.read(
        DriftSqlType.dateTime,
        data['${effectivePrefix}visited_at'],
      )!,
      hospitalName: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}hospital_name'],
      )!,
      department: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}department'],
      ),
      reason: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}reason'],
      ),
      diagnosis: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}diagnosis'],
      ),
      memo: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}memo'],
      ),
      amount: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}amount'],
      ),
      createdAt: attachedDatabase.typeMapping.read(
        DriftSqlType.dateTime,
        data['${effectivePrefix}created_at'],
      )!,
    );
  }

  @override
  $HospitalRecordsTable createAlias(String alias) {
    return $HospitalRecordsTable(attachedDatabase, alias);
  }
}

class HospitalRecord extends DataClass implements Insertable<HospitalRecord> {
  final String hospitalId;
  final String userId;
  final DateTime visitedAt;
  final String hospitalName;
  final String? department;
  final String? reason;
  final String? diagnosis;
  final String? memo;
  final int? amount;
  final DateTime createdAt;
  const HospitalRecord({
    required this.hospitalId,
    required this.userId,
    required this.visitedAt,
    required this.hospitalName,
    this.department,
    this.reason,
    this.diagnosis,
    this.memo,
    this.amount,
    required this.createdAt,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['hospital_id'] = Variable<String>(hospitalId);
    map['user_id'] = Variable<String>(userId);
    map['visited_at'] = Variable<DateTime>(visitedAt);
    map['hospital_name'] = Variable<String>(hospitalName);
    if (!nullToAbsent || department != null) {
      map['department'] = Variable<String>(department);
    }
    if (!nullToAbsent || reason != null) {
      map['reason'] = Variable<String>(reason);
    }
    if (!nullToAbsent || diagnosis != null) {
      map['diagnosis'] = Variable<String>(diagnosis);
    }
    if (!nullToAbsent || memo != null) {
      map['memo'] = Variable<String>(memo);
    }
    if (!nullToAbsent || amount != null) {
      map['amount'] = Variable<int>(amount);
    }
    map['created_at'] = Variable<DateTime>(createdAt);
    return map;
  }

  HospitalRecordsCompanion toCompanion(bool nullToAbsent) {
    return HospitalRecordsCompanion(
      hospitalId: Value(hospitalId),
      userId: Value(userId),
      visitedAt: Value(visitedAt),
      hospitalName: Value(hospitalName),
      department: department == null && nullToAbsent
          ? const Value.absent()
          : Value(department),
      reason: reason == null && nullToAbsent
          ? const Value.absent()
          : Value(reason),
      diagnosis: diagnosis == null && nullToAbsent
          ? const Value.absent()
          : Value(diagnosis),
      memo: memo == null && nullToAbsent ? const Value.absent() : Value(memo),
      amount: amount == null && nullToAbsent
          ? const Value.absent()
          : Value(amount),
      createdAt: Value(createdAt),
    );
  }

  factory HospitalRecord.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return HospitalRecord(
      hospitalId: serializer.fromJson<String>(json['hospitalId']),
      userId: serializer.fromJson<String>(json['userId']),
      visitedAt: serializer.fromJson<DateTime>(json['visitedAt']),
      hospitalName: serializer.fromJson<String>(json['hospitalName']),
      department: serializer.fromJson<String?>(json['department']),
      reason: serializer.fromJson<String?>(json['reason']),
      diagnosis: serializer.fromJson<String?>(json['diagnosis']),
      memo: serializer.fromJson<String?>(json['memo']),
      amount: serializer.fromJson<int?>(json['amount']),
      createdAt: serializer.fromJson<DateTime>(json['createdAt']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'hospitalId': serializer.toJson<String>(hospitalId),
      'userId': serializer.toJson<String>(userId),
      'visitedAt': serializer.toJson<DateTime>(visitedAt),
      'hospitalName': serializer.toJson<String>(hospitalName),
      'department': serializer.toJson<String?>(department),
      'reason': serializer.toJson<String?>(reason),
      'diagnosis': serializer.toJson<String?>(diagnosis),
      'memo': serializer.toJson<String?>(memo),
      'amount': serializer.toJson<int?>(amount),
      'createdAt': serializer.toJson<DateTime>(createdAt),
    };
  }

  HospitalRecord copyWith({
    String? hospitalId,
    String? userId,
    DateTime? visitedAt,
    String? hospitalName,
    Value<String?> department = const Value.absent(),
    Value<String?> reason = const Value.absent(),
    Value<String?> diagnosis = const Value.absent(),
    Value<String?> memo = const Value.absent(),
    Value<int?> amount = const Value.absent(),
    DateTime? createdAt,
  }) => HospitalRecord(
    hospitalId: hospitalId ?? this.hospitalId,
    userId: userId ?? this.userId,
    visitedAt: visitedAt ?? this.visitedAt,
    hospitalName: hospitalName ?? this.hospitalName,
    department: department.present ? department.value : this.department,
    reason: reason.present ? reason.value : this.reason,
    diagnosis: diagnosis.present ? diagnosis.value : this.diagnosis,
    memo: memo.present ? memo.value : this.memo,
    amount: amount.present ? amount.value : this.amount,
    createdAt: createdAt ?? this.createdAt,
  );
  HospitalRecord copyWithCompanion(HospitalRecordsCompanion data) {
    return HospitalRecord(
      hospitalId: data.hospitalId.present
          ? data.hospitalId.value
          : this.hospitalId,
      userId: data.userId.present ? data.userId.value : this.userId,
      visitedAt: data.visitedAt.present ? data.visitedAt.value : this.visitedAt,
      hospitalName: data.hospitalName.present
          ? data.hospitalName.value
          : this.hospitalName,
      department: data.department.present
          ? data.department.value
          : this.department,
      reason: data.reason.present ? data.reason.value : this.reason,
      diagnosis: data.diagnosis.present ? data.diagnosis.value : this.diagnosis,
      memo: data.memo.present ? data.memo.value : this.memo,
      amount: data.amount.present ? data.amount.value : this.amount,
      createdAt: data.createdAt.present ? data.createdAt.value : this.createdAt,
    );
  }

  @override
  String toString() {
    return (StringBuffer('HospitalRecord(')
          ..write('hospitalId: $hospitalId, ')
          ..write('userId: $userId, ')
          ..write('visitedAt: $visitedAt, ')
          ..write('hospitalName: $hospitalName, ')
          ..write('department: $department, ')
          ..write('reason: $reason, ')
          ..write('diagnosis: $diagnosis, ')
          ..write('memo: $memo, ')
          ..write('amount: $amount, ')
          ..write('createdAt: $createdAt')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(
    hospitalId,
    userId,
    visitedAt,
    hospitalName,
    department,
    reason,
    diagnosis,
    memo,
    amount,
    createdAt,
  );
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is HospitalRecord &&
          other.hospitalId == this.hospitalId &&
          other.userId == this.userId &&
          other.visitedAt == this.visitedAt &&
          other.hospitalName == this.hospitalName &&
          other.department == this.department &&
          other.reason == this.reason &&
          other.diagnosis == this.diagnosis &&
          other.memo == this.memo &&
          other.amount == this.amount &&
          other.createdAt == this.createdAt);
}

class HospitalRecordsCompanion extends UpdateCompanion<HospitalRecord> {
  final Value<String> hospitalId;
  final Value<String> userId;
  final Value<DateTime> visitedAt;
  final Value<String> hospitalName;
  final Value<String?> department;
  final Value<String?> reason;
  final Value<String?> diagnosis;
  final Value<String?> memo;
  final Value<int?> amount;
  final Value<DateTime> createdAt;
  final Value<int> rowid;
  const HospitalRecordsCompanion({
    this.hospitalId = const Value.absent(),
    this.userId = const Value.absent(),
    this.visitedAt = const Value.absent(),
    this.hospitalName = const Value.absent(),
    this.department = const Value.absent(),
    this.reason = const Value.absent(),
    this.diagnosis = const Value.absent(),
    this.memo = const Value.absent(),
    this.amount = const Value.absent(),
    this.createdAt = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  HospitalRecordsCompanion.insert({
    required String hospitalId,
    required String userId,
    this.visitedAt = const Value.absent(),
    required String hospitalName,
    this.department = const Value.absent(),
    this.reason = const Value.absent(),
    this.diagnosis = const Value.absent(),
    this.memo = const Value.absent(),
    this.amount = const Value.absent(),
    this.createdAt = const Value.absent(),
    this.rowid = const Value.absent(),
  }) : hospitalId = Value(hospitalId),
       userId = Value(userId),
       hospitalName = Value(hospitalName);
  static Insertable<HospitalRecord> custom({
    Expression<String>? hospitalId,
    Expression<String>? userId,
    Expression<DateTime>? visitedAt,
    Expression<String>? hospitalName,
    Expression<String>? department,
    Expression<String>? reason,
    Expression<String>? diagnosis,
    Expression<String>? memo,
    Expression<int>? amount,
    Expression<DateTime>? createdAt,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (hospitalId != null) 'hospital_id': hospitalId,
      if (userId != null) 'user_id': userId,
      if (visitedAt != null) 'visited_at': visitedAt,
      if (hospitalName != null) 'hospital_name': hospitalName,
      if (department != null) 'department': department,
      if (reason != null) 'reason': reason,
      if (diagnosis != null) 'diagnosis': diagnosis,
      if (memo != null) 'memo': memo,
      if (amount != null) 'amount': amount,
      if (createdAt != null) 'created_at': createdAt,
      if (rowid != null) 'rowid': rowid,
    });
  }

  HospitalRecordsCompanion copyWith({
    Value<String>? hospitalId,
    Value<String>? userId,
    Value<DateTime>? visitedAt,
    Value<String>? hospitalName,
    Value<String?>? department,
    Value<String?>? reason,
    Value<String?>? diagnosis,
    Value<String?>? memo,
    Value<int?>? amount,
    Value<DateTime>? createdAt,
    Value<int>? rowid,
  }) {
    return HospitalRecordsCompanion(
      hospitalId: hospitalId ?? this.hospitalId,
      userId: userId ?? this.userId,
      visitedAt: visitedAt ?? this.visitedAt,
      hospitalName: hospitalName ?? this.hospitalName,
      department: department ?? this.department,
      reason: reason ?? this.reason,
      diagnosis: diagnosis ?? this.diagnosis,
      memo: memo ?? this.memo,
      amount: amount ?? this.amount,
      createdAt: createdAt ?? this.createdAt,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (hospitalId.present) {
      map['hospital_id'] = Variable<String>(hospitalId.value);
    }
    if (userId.present) {
      map['user_id'] = Variable<String>(userId.value);
    }
    if (visitedAt.present) {
      map['visited_at'] = Variable<DateTime>(visitedAt.value);
    }
    if (hospitalName.present) {
      map['hospital_name'] = Variable<String>(hospitalName.value);
    }
    if (department.present) {
      map['department'] = Variable<String>(department.value);
    }
    if (reason.present) {
      map['reason'] = Variable<String>(reason.value);
    }
    if (diagnosis.present) {
      map['diagnosis'] = Variable<String>(diagnosis.value);
    }
    if (memo.present) {
      map['memo'] = Variable<String>(memo.value);
    }
    if (amount.present) {
      map['amount'] = Variable<int>(amount.value);
    }
    if (createdAt.present) {
      map['created_at'] = Variable<DateTime>(createdAt.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('HospitalRecordsCompanion(')
          ..write('hospitalId: $hospitalId, ')
          ..write('userId: $userId, ')
          ..write('visitedAt: $visitedAt, ')
          ..write('hospitalName: $hospitalName, ')
          ..write('department: $department, ')
          ..write('reason: $reason, ')
          ..write('diagnosis: $diagnosis, ')
          ..write('memo: $memo, ')
          ..write('amount: $amount, ')
          ..write('createdAt: $createdAt, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $SleepRecordsTable extends SleepRecords
    with TableInfo<$SleepRecordsTable, SleepRecord> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $SleepRecordsTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _sleepIdMeta = const VerificationMeta(
    'sleepId',
  );
  @override
  late final GeneratedColumn<String> sleepId = GeneratedColumn<String>(
    'sleep_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _userIdMeta = const VerificationMeta('userId');
  @override
  late final GeneratedColumn<String> userId = GeneratedColumn<String>(
    'user_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _bedAtMeta = const VerificationMeta('bedAt');
  @override
  late final GeneratedColumn<DateTime> bedAt = GeneratedColumn<DateTime>(
    'bed_at',
    aliasedName,
    false,
    type: DriftSqlType.dateTime,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _wokeAtMeta = const VerificationMeta('wokeAt');
  @override
  late final GeneratedColumn<DateTime> wokeAt = GeneratedColumn<DateTime>(
    'woke_at',
    aliasedName,
    true,
    type: DriftSqlType.dateTime,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _qualityScoreMeta = const VerificationMeta(
    'qualityScore',
  );
  @override
  late final GeneratedColumn<int> qualityScore = GeneratedColumn<int>(
    'quality_score',
    aliasedName,
    true,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _memoMeta = const VerificationMeta('memo');
  @override
  late final GeneratedColumn<String> memo = GeneratedColumn<String>(
    'memo',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _createdAtMeta = const VerificationMeta(
    'createdAt',
  );
  @override
  late final GeneratedColumn<DateTime> createdAt = GeneratedColumn<DateTime>(
    'created_at',
    aliasedName,
    false,
    type: DriftSqlType.dateTime,
    requiredDuringInsert: false,
    defaultValue: currentDateAndTime,
  );
  @override
  List<GeneratedColumn> get $columns => [
    sleepId,
    userId,
    bedAt,
    wokeAt,
    qualityScore,
    memo,
    createdAt,
  ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'sleep_records';
  @override
  VerificationContext validateIntegrity(
    Insertable<SleepRecord> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('sleep_id')) {
      context.handle(
        _sleepIdMeta,
        sleepId.isAcceptableOrUnknown(data['sleep_id']!, _sleepIdMeta),
      );
    } else if (isInserting) {
      context.missing(_sleepIdMeta);
    }
    if (data.containsKey('user_id')) {
      context.handle(
        _userIdMeta,
        userId.isAcceptableOrUnknown(data['user_id']!, _userIdMeta),
      );
    } else if (isInserting) {
      context.missing(_userIdMeta);
    }
    if (data.containsKey('bed_at')) {
      context.handle(
        _bedAtMeta,
        bedAt.isAcceptableOrUnknown(data['bed_at']!, _bedAtMeta),
      );
    } else if (isInserting) {
      context.missing(_bedAtMeta);
    }
    if (data.containsKey('woke_at')) {
      context.handle(
        _wokeAtMeta,
        wokeAt.isAcceptableOrUnknown(data['woke_at']!, _wokeAtMeta),
      );
    }
    if (data.containsKey('quality_score')) {
      context.handle(
        _qualityScoreMeta,
        qualityScore.isAcceptableOrUnknown(
          data['quality_score']!,
          _qualityScoreMeta,
        ),
      );
    }
    if (data.containsKey('memo')) {
      context.handle(
        _memoMeta,
        memo.isAcceptableOrUnknown(data['memo']!, _memoMeta),
      );
    }
    if (data.containsKey('created_at')) {
      context.handle(
        _createdAtMeta,
        createdAt.isAcceptableOrUnknown(data['created_at']!, _createdAtMeta),
      );
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {sleepId};
  @override
  SleepRecord map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return SleepRecord(
      sleepId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}sleep_id'],
      )!,
      userId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}user_id'],
      )!,
      bedAt: attachedDatabase.typeMapping.read(
        DriftSqlType.dateTime,
        data['${effectivePrefix}bed_at'],
      )!,
      wokeAt: attachedDatabase.typeMapping.read(
        DriftSqlType.dateTime,
        data['${effectivePrefix}woke_at'],
      ),
      qualityScore: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}quality_score'],
      ),
      memo: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}memo'],
      ),
      createdAt: attachedDatabase.typeMapping.read(
        DriftSqlType.dateTime,
        data['${effectivePrefix}created_at'],
      )!,
    );
  }

  @override
  $SleepRecordsTable createAlias(String alias) {
    return $SleepRecordsTable(attachedDatabase, alias);
  }
}

class SleepRecord extends DataClass implements Insertable<SleepRecord> {
  final String sleepId;
  final String userId;
  final DateTime bedAt;
  final DateTime? wokeAt;
  final int? qualityScore;
  final String? memo;
  final DateTime createdAt;
  const SleepRecord({
    required this.sleepId,
    required this.userId,
    required this.bedAt,
    this.wokeAt,
    this.qualityScore,
    this.memo,
    required this.createdAt,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['sleep_id'] = Variable<String>(sleepId);
    map['user_id'] = Variable<String>(userId);
    map['bed_at'] = Variable<DateTime>(bedAt);
    if (!nullToAbsent || wokeAt != null) {
      map['woke_at'] = Variable<DateTime>(wokeAt);
    }
    if (!nullToAbsent || qualityScore != null) {
      map['quality_score'] = Variable<int>(qualityScore);
    }
    if (!nullToAbsent || memo != null) {
      map['memo'] = Variable<String>(memo);
    }
    map['created_at'] = Variable<DateTime>(createdAt);
    return map;
  }

  SleepRecordsCompanion toCompanion(bool nullToAbsent) {
    return SleepRecordsCompanion(
      sleepId: Value(sleepId),
      userId: Value(userId),
      bedAt: Value(bedAt),
      wokeAt: wokeAt == null && nullToAbsent
          ? const Value.absent()
          : Value(wokeAt),
      qualityScore: qualityScore == null && nullToAbsent
          ? const Value.absent()
          : Value(qualityScore),
      memo: memo == null && nullToAbsent ? const Value.absent() : Value(memo),
      createdAt: Value(createdAt),
    );
  }

  factory SleepRecord.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return SleepRecord(
      sleepId: serializer.fromJson<String>(json['sleepId']),
      userId: serializer.fromJson<String>(json['userId']),
      bedAt: serializer.fromJson<DateTime>(json['bedAt']),
      wokeAt: serializer.fromJson<DateTime?>(json['wokeAt']),
      qualityScore: serializer.fromJson<int?>(json['qualityScore']),
      memo: serializer.fromJson<String?>(json['memo']),
      createdAt: serializer.fromJson<DateTime>(json['createdAt']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'sleepId': serializer.toJson<String>(sleepId),
      'userId': serializer.toJson<String>(userId),
      'bedAt': serializer.toJson<DateTime>(bedAt),
      'wokeAt': serializer.toJson<DateTime?>(wokeAt),
      'qualityScore': serializer.toJson<int?>(qualityScore),
      'memo': serializer.toJson<String?>(memo),
      'createdAt': serializer.toJson<DateTime>(createdAt),
    };
  }

  SleepRecord copyWith({
    String? sleepId,
    String? userId,
    DateTime? bedAt,
    Value<DateTime?> wokeAt = const Value.absent(),
    Value<int?> qualityScore = const Value.absent(),
    Value<String?> memo = const Value.absent(),
    DateTime? createdAt,
  }) => SleepRecord(
    sleepId: sleepId ?? this.sleepId,
    userId: userId ?? this.userId,
    bedAt: bedAt ?? this.bedAt,
    wokeAt: wokeAt.present ? wokeAt.value : this.wokeAt,
    qualityScore: qualityScore.present ? qualityScore.value : this.qualityScore,
    memo: memo.present ? memo.value : this.memo,
    createdAt: createdAt ?? this.createdAt,
  );
  SleepRecord copyWithCompanion(SleepRecordsCompanion data) {
    return SleepRecord(
      sleepId: data.sleepId.present ? data.sleepId.value : this.sleepId,
      userId: data.userId.present ? data.userId.value : this.userId,
      bedAt: data.bedAt.present ? data.bedAt.value : this.bedAt,
      wokeAt: data.wokeAt.present ? data.wokeAt.value : this.wokeAt,
      qualityScore: data.qualityScore.present
          ? data.qualityScore.value
          : this.qualityScore,
      memo: data.memo.present ? data.memo.value : this.memo,
      createdAt: data.createdAt.present ? data.createdAt.value : this.createdAt,
    );
  }

  @override
  String toString() {
    return (StringBuffer('SleepRecord(')
          ..write('sleepId: $sleepId, ')
          ..write('userId: $userId, ')
          ..write('bedAt: $bedAt, ')
          ..write('wokeAt: $wokeAt, ')
          ..write('qualityScore: $qualityScore, ')
          ..write('memo: $memo, ')
          ..write('createdAt: $createdAt')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(
    sleepId,
    userId,
    bedAt,
    wokeAt,
    qualityScore,
    memo,
    createdAt,
  );
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is SleepRecord &&
          other.sleepId == this.sleepId &&
          other.userId == this.userId &&
          other.bedAt == this.bedAt &&
          other.wokeAt == this.wokeAt &&
          other.qualityScore == this.qualityScore &&
          other.memo == this.memo &&
          other.createdAt == this.createdAt);
}

class SleepRecordsCompanion extends UpdateCompanion<SleepRecord> {
  final Value<String> sleepId;
  final Value<String> userId;
  final Value<DateTime> bedAt;
  final Value<DateTime?> wokeAt;
  final Value<int?> qualityScore;
  final Value<String?> memo;
  final Value<DateTime> createdAt;
  final Value<int> rowid;
  const SleepRecordsCompanion({
    this.sleepId = const Value.absent(),
    this.userId = const Value.absent(),
    this.bedAt = const Value.absent(),
    this.wokeAt = const Value.absent(),
    this.qualityScore = const Value.absent(),
    this.memo = const Value.absent(),
    this.createdAt = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  SleepRecordsCompanion.insert({
    required String sleepId,
    required String userId,
    required DateTime bedAt,
    this.wokeAt = const Value.absent(),
    this.qualityScore = const Value.absent(),
    this.memo = const Value.absent(),
    this.createdAt = const Value.absent(),
    this.rowid = const Value.absent(),
  }) : sleepId = Value(sleepId),
       userId = Value(userId),
       bedAt = Value(bedAt);
  static Insertable<SleepRecord> custom({
    Expression<String>? sleepId,
    Expression<String>? userId,
    Expression<DateTime>? bedAt,
    Expression<DateTime>? wokeAt,
    Expression<int>? qualityScore,
    Expression<String>? memo,
    Expression<DateTime>? createdAt,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (sleepId != null) 'sleep_id': sleepId,
      if (userId != null) 'user_id': userId,
      if (bedAt != null) 'bed_at': bedAt,
      if (wokeAt != null) 'woke_at': wokeAt,
      if (qualityScore != null) 'quality_score': qualityScore,
      if (memo != null) 'memo': memo,
      if (createdAt != null) 'created_at': createdAt,
      if (rowid != null) 'rowid': rowid,
    });
  }

  SleepRecordsCompanion copyWith({
    Value<String>? sleepId,
    Value<String>? userId,
    Value<DateTime>? bedAt,
    Value<DateTime?>? wokeAt,
    Value<int?>? qualityScore,
    Value<String?>? memo,
    Value<DateTime>? createdAt,
    Value<int>? rowid,
  }) {
    return SleepRecordsCompanion(
      sleepId: sleepId ?? this.sleepId,
      userId: userId ?? this.userId,
      bedAt: bedAt ?? this.bedAt,
      wokeAt: wokeAt ?? this.wokeAt,
      qualityScore: qualityScore ?? this.qualityScore,
      memo: memo ?? this.memo,
      createdAt: createdAt ?? this.createdAt,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (sleepId.present) {
      map['sleep_id'] = Variable<String>(sleepId.value);
    }
    if (userId.present) {
      map['user_id'] = Variable<String>(userId.value);
    }
    if (bedAt.present) {
      map['bed_at'] = Variable<DateTime>(bedAt.value);
    }
    if (wokeAt.present) {
      map['woke_at'] = Variable<DateTime>(wokeAt.value);
    }
    if (qualityScore.present) {
      map['quality_score'] = Variable<int>(qualityScore.value);
    }
    if (memo.present) {
      map['memo'] = Variable<String>(memo.value);
    }
    if (createdAt.present) {
      map['created_at'] = Variable<DateTime>(createdAt.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('SleepRecordsCompanion(')
          ..write('sleepId: $sleepId, ')
          ..write('userId: $userId, ')
          ..write('bedAt: $bedAt, ')
          ..write('wokeAt: $wokeAt, ')
          ..write('qualityScore: $qualityScore, ')
          ..write('memo: $memo, ')
          ..write('createdAt: $createdAt, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $RoutineItemsTable extends RoutineItems
    with TableInfo<$RoutineItemsTable, RoutineItem> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $RoutineItemsTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _routineIdMeta = const VerificationMeta(
    'routineId',
  );
  @override
  late final GeneratedColumn<String> routineId = GeneratedColumn<String>(
    'routine_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _userIdMeta = const VerificationMeta('userId');
  @override
  late final GeneratedColumn<String> userId = GeneratedColumn<String>(
    'user_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _nameMeta = const VerificationMeta('name');
  @override
  late final GeneratedColumn<String> name = GeneratedColumn<String>(
    'name',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _repeatMeta = const VerificationMeta('repeat');
  @override
  late final GeneratedColumn<String> repeat = GeneratedColumn<String>(
    'repeat',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
    defaultValue: const Constant('daily'),
  );
  static const VerificationMeta _weekdaysJsonMeta = const VerificationMeta(
    'weekdaysJson',
  );
  @override
  late final GeneratedColumn<String> weekdaysJson = GeneratedColumn<String>(
    'weekdays_json',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _alertTimeMeta = const VerificationMeta(
    'alertTime',
  );
  @override
  late final GeneratedColumn<String> alertTime = GeneratedColumn<String>(
    'alert_time',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _isEnabledMeta = const VerificationMeta(
    'isEnabled',
  );
  @override
  late final GeneratedColumn<bool> isEnabled = GeneratedColumn<bool>(
    'is_enabled',
    aliasedName,
    false,
    type: DriftSqlType.bool,
    requiredDuringInsert: false,
    defaultConstraints: GeneratedColumn.constraintIsAlways(
      'CHECK ("is_enabled" IN (0, 1))',
    ),
    defaultValue: const Constant(true),
  );
  static const VerificationMeta _sortOrderMeta = const VerificationMeta(
    'sortOrder',
  );
  @override
  late final GeneratedColumn<int> sortOrder = GeneratedColumn<int>(
    'sort_order',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
    defaultValue: const Constant(0),
  );
  static const VerificationMeta _createdAtMeta = const VerificationMeta(
    'createdAt',
  );
  @override
  late final GeneratedColumn<DateTime> createdAt = GeneratedColumn<DateTime>(
    'created_at',
    aliasedName,
    false,
    type: DriftSqlType.dateTime,
    requiredDuringInsert: false,
    defaultValue: currentDateAndTime,
  );
  static const VerificationMeta _updatedAtMeta = const VerificationMeta(
    'updatedAt',
  );
  @override
  late final GeneratedColumn<DateTime> updatedAt = GeneratedColumn<DateTime>(
    'updated_at',
    aliasedName,
    false,
    type: DriftSqlType.dateTime,
    requiredDuringInsert: false,
    defaultValue: currentDateAndTime,
  );
  @override
  List<GeneratedColumn> get $columns => [
    routineId,
    userId,
    name,
    repeat,
    weekdaysJson,
    alertTime,
    isEnabled,
    sortOrder,
    createdAt,
    updatedAt,
  ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'routine_items';
  @override
  VerificationContext validateIntegrity(
    Insertable<RoutineItem> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('routine_id')) {
      context.handle(
        _routineIdMeta,
        routineId.isAcceptableOrUnknown(data['routine_id']!, _routineIdMeta),
      );
    } else if (isInserting) {
      context.missing(_routineIdMeta);
    }
    if (data.containsKey('user_id')) {
      context.handle(
        _userIdMeta,
        userId.isAcceptableOrUnknown(data['user_id']!, _userIdMeta),
      );
    } else if (isInserting) {
      context.missing(_userIdMeta);
    }
    if (data.containsKey('name')) {
      context.handle(
        _nameMeta,
        name.isAcceptableOrUnknown(data['name']!, _nameMeta),
      );
    } else if (isInserting) {
      context.missing(_nameMeta);
    }
    if (data.containsKey('repeat')) {
      context.handle(
        _repeatMeta,
        repeat.isAcceptableOrUnknown(data['repeat']!, _repeatMeta),
      );
    }
    if (data.containsKey('weekdays_json')) {
      context.handle(
        _weekdaysJsonMeta,
        weekdaysJson.isAcceptableOrUnknown(
          data['weekdays_json']!,
          _weekdaysJsonMeta,
        ),
      );
    }
    if (data.containsKey('alert_time')) {
      context.handle(
        _alertTimeMeta,
        alertTime.isAcceptableOrUnknown(data['alert_time']!, _alertTimeMeta),
      );
    }
    if (data.containsKey('is_enabled')) {
      context.handle(
        _isEnabledMeta,
        isEnabled.isAcceptableOrUnknown(data['is_enabled']!, _isEnabledMeta),
      );
    }
    if (data.containsKey('sort_order')) {
      context.handle(
        _sortOrderMeta,
        sortOrder.isAcceptableOrUnknown(data['sort_order']!, _sortOrderMeta),
      );
    }
    if (data.containsKey('created_at')) {
      context.handle(
        _createdAtMeta,
        createdAt.isAcceptableOrUnknown(data['created_at']!, _createdAtMeta),
      );
    }
    if (data.containsKey('updated_at')) {
      context.handle(
        _updatedAtMeta,
        updatedAt.isAcceptableOrUnknown(data['updated_at']!, _updatedAtMeta),
      );
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {routineId};
  @override
  RoutineItem map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return RoutineItem(
      routineId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}routine_id'],
      )!,
      userId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}user_id'],
      )!,
      name: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}name'],
      )!,
      repeat: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}repeat'],
      )!,
      weekdaysJson: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}weekdays_json'],
      ),
      alertTime: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}alert_time'],
      ),
      isEnabled: attachedDatabase.typeMapping.read(
        DriftSqlType.bool,
        data['${effectivePrefix}is_enabled'],
      )!,
      sortOrder: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}sort_order'],
      )!,
      createdAt: attachedDatabase.typeMapping.read(
        DriftSqlType.dateTime,
        data['${effectivePrefix}created_at'],
      )!,
      updatedAt: attachedDatabase.typeMapping.read(
        DriftSqlType.dateTime,
        data['${effectivePrefix}updated_at'],
      )!,
    );
  }

  @override
  $RoutineItemsTable createAlias(String alias) {
    return $RoutineItemsTable(attachedDatabase, alias);
  }
}

class RoutineItem extends DataClass implements Insertable<RoutineItem> {
  final String routineId;
  final String userId;
  final String name;
  final String repeat;
  final String? weekdaysJson;
  final String? alertTime;
  final bool isEnabled;
  final int sortOrder;
  final DateTime createdAt;
  final DateTime updatedAt;
  const RoutineItem({
    required this.routineId,
    required this.userId,
    required this.name,
    required this.repeat,
    this.weekdaysJson,
    this.alertTime,
    required this.isEnabled,
    required this.sortOrder,
    required this.createdAt,
    required this.updatedAt,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['routine_id'] = Variable<String>(routineId);
    map['user_id'] = Variable<String>(userId);
    map['name'] = Variable<String>(name);
    map['repeat'] = Variable<String>(repeat);
    if (!nullToAbsent || weekdaysJson != null) {
      map['weekdays_json'] = Variable<String>(weekdaysJson);
    }
    if (!nullToAbsent || alertTime != null) {
      map['alert_time'] = Variable<String>(alertTime);
    }
    map['is_enabled'] = Variable<bool>(isEnabled);
    map['sort_order'] = Variable<int>(sortOrder);
    map['created_at'] = Variable<DateTime>(createdAt);
    map['updated_at'] = Variable<DateTime>(updatedAt);
    return map;
  }

  RoutineItemsCompanion toCompanion(bool nullToAbsent) {
    return RoutineItemsCompanion(
      routineId: Value(routineId),
      userId: Value(userId),
      name: Value(name),
      repeat: Value(repeat),
      weekdaysJson: weekdaysJson == null && nullToAbsent
          ? const Value.absent()
          : Value(weekdaysJson),
      alertTime: alertTime == null && nullToAbsent
          ? const Value.absent()
          : Value(alertTime),
      isEnabled: Value(isEnabled),
      sortOrder: Value(sortOrder),
      createdAt: Value(createdAt),
      updatedAt: Value(updatedAt),
    );
  }

  factory RoutineItem.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return RoutineItem(
      routineId: serializer.fromJson<String>(json['routineId']),
      userId: serializer.fromJson<String>(json['userId']),
      name: serializer.fromJson<String>(json['name']),
      repeat: serializer.fromJson<String>(json['repeat']),
      weekdaysJson: serializer.fromJson<String?>(json['weekdaysJson']),
      alertTime: serializer.fromJson<String?>(json['alertTime']),
      isEnabled: serializer.fromJson<bool>(json['isEnabled']),
      sortOrder: serializer.fromJson<int>(json['sortOrder']),
      createdAt: serializer.fromJson<DateTime>(json['createdAt']),
      updatedAt: serializer.fromJson<DateTime>(json['updatedAt']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'routineId': serializer.toJson<String>(routineId),
      'userId': serializer.toJson<String>(userId),
      'name': serializer.toJson<String>(name),
      'repeat': serializer.toJson<String>(repeat),
      'weekdaysJson': serializer.toJson<String?>(weekdaysJson),
      'alertTime': serializer.toJson<String?>(alertTime),
      'isEnabled': serializer.toJson<bool>(isEnabled),
      'sortOrder': serializer.toJson<int>(sortOrder),
      'createdAt': serializer.toJson<DateTime>(createdAt),
      'updatedAt': serializer.toJson<DateTime>(updatedAt),
    };
  }

  RoutineItem copyWith({
    String? routineId,
    String? userId,
    String? name,
    String? repeat,
    Value<String?> weekdaysJson = const Value.absent(),
    Value<String?> alertTime = const Value.absent(),
    bool? isEnabled,
    int? sortOrder,
    DateTime? createdAt,
    DateTime? updatedAt,
  }) => RoutineItem(
    routineId: routineId ?? this.routineId,
    userId: userId ?? this.userId,
    name: name ?? this.name,
    repeat: repeat ?? this.repeat,
    weekdaysJson: weekdaysJson.present ? weekdaysJson.value : this.weekdaysJson,
    alertTime: alertTime.present ? alertTime.value : this.alertTime,
    isEnabled: isEnabled ?? this.isEnabled,
    sortOrder: sortOrder ?? this.sortOrder,
    createdAt: createdAt ?? this.createdAt,
    updatedAt: updatedAt ?? this.updatedAt,
  );
  RoutineItem copyWithCompanion(RoutineItemsCompanion data) {
    return RoutineItem(
      routineId: data.routineId.present ? data.routineId.value : this.routineId,
      userId: data.userId.present ? data.userId.value : this.userId,
      name: data.name.present ? data.name.value : this.name,
      repeat: data.repeat.present ? data.repeat.value : this.repeat,
      weekdaysJson: data.weekdaysJson.present
          ? data.weekdaysJson.value
          : this.weekdaysJson,
      alertTime: data.alertTime.present ? data.alertTime.value : this.alertTime,
      isEnabled: data.isEnabled.present ? data.isEnabled.value : this.isEnabled,
      sortOrder: data.sortOrder.present ? data.sortOrder.value : this.sortOrder,
      createdAt: data.createdAt.present ? data.createdAt.value : this.createdAt,
      updatedAt: data.updatedAt.present ? data.updatedAt.value : this.updatedAt,
    );
  }

  @override
  String toString() {
    return (StringBuffer('RoutineItem(')
          ..write('routineId: $routineId, ')
          ..write('userId: $userId, ')
          ..write('name: $name, ')
          ..write('repeat: $repeat, ')
          ..write('weekdaysJson: $weekdaysJson, ')
          ..write('alertTime: $alertTime, ')
          ..write('isEnabled: $isEnabled, ')
          ..write('sortOrder: $sortOrder, ')
          ..write('createdAt: $createdAt, ')
          ..write('updatedAt: $updatedAt')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(
    routineId,
    userId,
    name,
    repeat,
    weekdaysJson,
    alertTime,
    isEnabled,
    sortOrder,
    createdAt,
    updatedAt,
  );
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is RoutineItem &&
          other.routineId == this.routineId &&
          other.userId == this.userId &&
          other.name == this.name &&
          other.repeat == this.repeat &&
          other.weekdaysJson == this.weekdaysJson &&
          other.alertTime == this.alertTime &&
          other.isEnabled == this.isEnabled &&
          other.sortOrder == this.sortOrder &&
          other.createdAt == this.createdAt &&
          other.updatedAt == this.updatedAt);
}

class RoutineItemsCompanion extends UpdateCompanion<RoutineItem> {
  final Value<String> routineId;
  final Value<String> userId;
  final Value<String> name;
  final Value<String> repeat;
  final Value<String?> weekdaysJson;
  final Value<String?> alertTime;
  final Value<bool> isEnabled;
  final Value<int> sortOrder;
  final Value<DateTime> createdAt;
  final Value<DateTime> updatedAt;
  final Value<int> rowid;
  const RoutineItemsCompanion({
    this.routineId = const Value.absent(),
    this.userId = const Value.absent(),
    this.name = const Value.absent(),
    this.repeat = const Value.absent(),
    this.weekdaysJson = const Value.absent(),
    this.alertTime = const Value.absent(),
    this.isEnabled = const Value.absent(),
    this.sortOrder = const Value.absent(),
    this.createdAt = const Value.absent(),
    this.updatedAt = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  RoutineItemsCompanion.insert({
    required String routineId,
    required String userId,
    required String name,
    this.repeat = const Value.absent(),
    this.weekdaysJson = const Value.absent(),
    this.alertTime = const Value.absent(),
    this.isEnabled = const Value.absent(),
    this.sortOrder = const Value.absent(),
    this.createdAt = const Value.absent(),
    this.updatedAt = const Value.absent(),
    this.rowid = const Value.absent(),
  }) : routineId = Value(routineId),
       userId = Value(userId),
       name = Value(name);
  static Insertable<RoutineItem> custom({
    Expression<String>? routineId,
    Expression<String>? userId,
    Expression<String>? name,
    Expression<String>? repeat,
    Expression<String>? weekdaysJson,
    Expression<String>? alertTime,
    Expression<bool>? isEnabled,
    Expression<int>? sortOrder,
    Expression<DateTime>? createdAt,
    Expression<DateTime>? updatedAt,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (routineId != null) 'routine_id': routineId,
      if (userId != null) 'user_id': userId,
      if (name != null) 'name': name,
      if (repeat != null) 'repeat': repeat,
      if (weekdaysJson != null) 'weekdays_json': weekdaysJson,
      if (alertTime != null) 'alert_time': alertTime,
      if (isEnabled != null) 'is_enabled': isEnabled,
      if (sortOrder != null) 'sort_order': sortOrder,
      if (createdAt != null) 'created_at': createdAt,
      if (updatedAt != null) 'updated_at': updatedAt,
      if (rowid != null) 'rowid': rowid,
    });
  }

  RoutineItemsCompanion copyWith({
    Value<String>? routineId,
    Value<String>? userId,
    Value<String>? name,
    Value<String>? repeat,
    Value<String?>? weekdaysJson,
    Value<String?>? alertTime,
    Value<bool>? isEnabled,
    Value<int>? sortOrder,
    Value<DateTime>? createdAt,
    Value<DateTime>? updatedAt,
    Value<int>? rowid,
  }) {
    return RoutineItemsCompanion(
      routineId: routineId ?? this.routineId,
      userId: userId ?? this.userId,
      name: name ?? this.name,
      repeat: repeat ?? this.repeat,
      weekdaysJson: weekdaysJson ?? this.weekdaysJson,
      alertTime: alertTime ?? this.alertTime,
      isEnabled: isEnabled ?? this.isEnabled,
      sortOrder: sortOrder ?? this.sortOrder,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (routineId.present) {
      map['routine_id'] = Variable<String>(routineId.value);
    }
    if (userId.present) {
      map['user_id'] = Variable<String>(userId.value);
    }
    if (name.present) {
      map['name'] = Variable<String>(name.value);
    }
    if (repeat.present) {
      map['repeat'] = Variable<String>(repeat.value);
    }
    if (weekdaysJson.present) {
      map['weekdays_json'] = Variable<String>(weekdaysJson.value);
    }
    if (alertTime.present) {
      map['alert_time'] = Variable<String>(alertTime.value);
    }
    if (isEnabled.present) {
      map['is_enabled'] = Variable<bool>(isEnabled.value);
    }
    if (sortOrder.present) {
      map['sort_order'] = Variable<int>(sortOrder.value);
    }
    if (createdAt.present) {
      map['created_at'] = Variable<DateTime>(createdAt.value);
    }
    if (updatedAt.present) {
      map['updated_at'] = Variable<DateTime>(updatedAt.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('RoutineItemsCompanion(')
          ..write('routineId: $routineId, ')
          ..write('userId: $userId, ')
          ..write('name: $name, ')
          ..write('repeat: $repeat, ')
          ..write('weekdaysJson: $weekdaysJson, ')
          ..write('alertTime: $alertTime, ')
          ..write('isEnabled: $isEnabled, ')
          ..write('sortOrder: $sortOrder, ')
          ..write('createdAt: $createdAt, ')
          ..write('updatedAt: $updatedAt, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $RoutineCompletionsTable extends RoutineCompletions
    with TableInfo<$RoutineCompletionsTable, RoutineCompletion> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $RoutineCompletionsTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _completionIdMeta = const VerificationMeta(
    'completionId',
  );
  @override
  late final GeneratedColumn<String> completionId = GeneratedColumn<String>(
    'completion_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _routineIdMeta = const VerificationMeta(
    'routineId',
  );
  @override
  late final GeneratedColumn<String> routineId = GeneratedColumn<String>(
    'routine_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _userIdMeta = const VerificationMeta('userId');
  @override
  late final GeneratedColumn<String> userId = GeneratedColumn<String>(
    'user_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _completedDateMeta = const VerificationMeta(
    'completedDate',
  );
  @override
  late final GeneratedColumn<String> completedDate = GeneratedColumn<String>(
    'completed_date',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _completedAtMeta = const VerificationMeta(
    'completedAt',
  );
  @override
  late final GeneratedColumn<DateTime> completedAt = GeneratedColumn<DateTime>(
    'completed_at',
    aliasedName,
    false,
    type: DriftSqlType.dateTime,
    requiredDuringInsert: false,
    defaultValue: currentDateAndTime,
  );
  @override
  List<GeneratedColumn> get $columns => [
    completionId,
    routineId,
    userId,
    completedDate,
    completedAt,
  ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'routine_completions';
  @override
  VerificationContext validateIntegrity(
    Insertable<RoutineCompletion> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('completion_id')) {
      context.handle(
        _completionIdMeta,
        completionId.isAcceptableOrUnknown(
          data['completion_id']!,
          _completionIdMeta,
        ),
      );
    } else if (isInserting) {
      context.missing(_completionIdMeta);
    }
    if (data.containsKey('routine_id')) {
      context.handle(
        _routineIdMeta,
        routineId.isAcceptableOrUnknown(data['routine_id']!, _routineIdMeta),
      );
    } else if (isInserting) {
      context.missing(_routineIdMeta);
    }
    if (data.containsKey('user_id')) {
      context.handle(
        _userIdMeta,
        userId.isAcceptableOrUnknown(data['user_id']!, _userIdMeta),
      );
    } else if (isInserting) {
      context.missing(_userIdMeta);
    }
    if (data.containsKey('completed_date')) {
      context.handle(
        _completedDateMeta,
        completedDate.isAcceptableOrUnknown(
          data['completed_date']!,
          _completedDateMeta,
        ),
      );
    } else if (isInserting) {
      context.missing(_completedDateMeta);
    }
    if (data.containsKey('completed_at')) {
      context.handle(
        _completedAtMeta,
        completedAt.isAcceptableOrUnknown(
          data['completed_at']!,
          _completedAtMeta,
        ),
      );
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {completionId};
  @override
  RoutineCompletion map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return RoutineCompletion(
      completionId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}completion_id'],
      )!,
      routineId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}routine_id'],
      )!,
      userId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}user_id'],
      )!,
      completedDate: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}completed_date'],
      )!,
      completedAt: attachedDatabase.typeMapping.read(
        DriftSqlType.dateTime,
        data['${effectivePrefix}completed_at'],
      )!,
    );
  }

  @override
  $RoutineCompletionsTable createAlias(String alias) {
    return $RoutineCompletionsTable(attachedDatabase, alias);
  }
}

class RoutineCompletion extends DataClass
    implements Insertable<RoutineCompletion> {
  final String completionId;
  final String routineId;
  final String userId;
  final String completedDate;
  final DateTime completedAt;
  const RoutineCompletion({
    required this.completionId,
    required this.routineId,
    required this.userId,
    required this.completedDate,
    required this.completedAt,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['completion_id'] = Variable<String>(completionId);
    map['routine_id'] = Variable<String>(routineId);
    map['user_id'] = Variable<String>(userId);
    map['completed_date'] = Variable<String>(completedDate);
    map['completed_at'] = Variable<DateTime>(completedAt);
    return map;
  }

  RoutineCompletionsCompanion toCompanion(bool nullToAbsent) {
    return RoutineCompletionsCompanion(
      completionId: Value(completionId),
      routineId: Value(routineId),
      userId: Value(userId),
      completedDate: Value(completedDate),
      completedAt: Value(completedAt),
    );
  }

  factory RoutineCompletion.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return RoutineCompletion(
      completionId: serializer.fromJson<String>(json['completionId']),
      routineId: serializer.fromJson<String>(json['routineId']),
      userId: serializer.fromJson<String>(json['userId']),
      completedDate: serializer.fromJson<String>(json['completedDate']),
      completedAt: serializer.fromJson<DateTime>(json['completedAt']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'completionId': serializer.toJson<String>(completionId),
      'routineId': serializer.toJson<String>(routineId),
      'userId': serializer.toJson<String>(userId),
      'completedDate': serializer.toJson<String>(completedDate),
      'completedAt': serializer.toJson<DateTime>(completedAt),
    };
  }

  RoutineCompletion copyWith({
    String? completionId,
    String? routineId,
    String? userId,
    String? completedDate,
    DateTime? completedAt,
  }) => RoutineCompletion(
    completionId: completionId ?? this.completionId,
    routineId: routineId ?? this.routineId,
    userId: userId ?? this.userId,
    completedDate: completedDate ?? this.completedDate,
    completedAt: completedAt ?? this.completedAt,
  );
  RoutineCompletion copyWithCompanion(RoutineCompletionsCompanion data) {
    return RoutineCompletion(
      completionId: data.completionId.present
          ? data.completionId.value
          : this.completionId,
      routineId: data.routineId.present ? data.routineId.value : this.routineId,
      userId: data.userId.present ? data.userId.value : this.userId,
      completedDate: data.completedDate.present
          ? data.completedDate.value
          : this.completedDate,
      completedAt: data.completedAt.present
          ? data.completedAt.value
          : this.completedAt,
    );
  }

  @override
  String toString() {
    return (StringBuffer('RoutineCompletion(')
          ..write('completionId: $completionId, ')
          ..write('routineId: $routineId, ')
          ..write('userId: $userId, ')
          ..write('completedDate: $completedDate, ')
          ..write('completedAt: $completedAt')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode =>
      Object.hash(completionId, routineId, userId, completedDate, completedAt);
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is RoutineCompletion &&
          other.completionId == this.completionId &&
          other.routineId == this.routineId &&
          other.userId == this.userId &&
          other.completedDate == this.completedDate &&
          other.completedAt == this.completedAt);
}

class RoutineCompletionsCompanion extends UpdateCompanion<RoutineCompletion> {
  final Value<String> completionId;
  final Value<String> routineId;
  final Value<String> userId;
  final Value<String> completedDate;
  final Value<DateTime> completedAt;
  final Value<int> rowid;
  const RoutineCompletionsCompanion({
    this.completionId = const Value.absent(),
    this.routineId = const Value.absent(),
    this.userId = const Value.absent(),
    this.completedDate = const Value.absent(),
    this.completedAt = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  RoutineCompletionsCompanion.insert({
    required String completionId,
    required String routineId,
    required String userId,
    required String completedDate,
    this.completedAt = const Value.absent(),
    this.rowid = const Value.absent(),
  }) : completionId = Value(completionId),
       routineId = Value(routineId),
       userId = Value(userId),
       completedDate = Value(completedDate);
  static Insertable<RoutineCompletion> custom({
    Expression<String>? completionId,
    Expression<String>? routineId,
    Expression<String>? userId,
    Expression<String>? completedDate,
    Expression<DateTime>? completedAt,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (completionId != null) 'completion_id': completionId,
      if (routineId != null) 'routine_id': routineId,
      if (userId != null) 'user_id': userId,
      if (completedDate != null) 'completed_date': completedDate,
      if (completedAt != null) 'completed_at': completedAt,
      if (rowid != null) 'rowid': rowid,
    });
  }

  RoutineCompletionsCompanion copyWith({
    Value<String>? completionId,
    Value<String>? routineId,
    Value<String>? userId,
    Value<String>? completedDate,
    Value<DateTime>? completedAt,
    Value<int>? rowid,
  }) {
    return RoutineCompletionsCompanion(
      completionId: completionId ?? this.completionId,
      routineId: routineId ?? this.routineId,
      userId: userId ?? this.userId,
      completedDate: completedDate ?? this.completedDate,
      completedAt: completedAt ?? this.completedAt,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (completionId.present) {
      map['completion_id'] = Variable<String>(completionId.value);
    }
    if (routineId.present) {
      map['routine_id'] = Variable<String>(routineId.value);
    }
    if (userId.present) {
      map['user_id'] = Variable<String>(userId.value);
    }
    if (completedDate.present) {
      map['completed_date'] = Variable<String>(completedDate.value);
    }
    if (completedAt.present) {
      map['completed_at'] = Variable<DateTime>(completedAt.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('RoutineCompletionsCompanion(')
          ..write('completionId: $completionId, ')
          ..write('routineId: $routineId, ')
          ..write('userId: $userId, ')
          ..write('completedDate: $completedDate, ')
          ..write('completedAt: $completedAt, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $FashionRecordsTable extends FashionRecords
    with TableInfo<$FashionRecordsTable, FashionRecord> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $FashionRecordsTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _fashionIdMeta = const VerificationMeta(
    'fashionId',
  );
  @override
  late final GeneratedColumn<String> fashionId = GeneratedColumn<String>(
    'fashion_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _userIdMeta = const VerificationMeta('userId');
  @override
  late final GeneratedColumn<String> userId = GeneratedColumn<String>(
    'user_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _photoPathMeta = const VerificationMeta(
    'photoPath',
  );
  @override
  late final GeneratedColumn<String> photoPath = GeneratedColumn<String>(
    'photo_path',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _llmAnalysisMeta = const VerificationMeta(
    'llmAnalysis',
  );
  @override
  late final GeneratedColumn<String> llmAnalysis = GeneratedColumn<String>(
    'llm_analysis',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _weatherSummaryMeta = const VerificationMeta(
    'weatherSummary',
  );
  @override
  late final GeneratedColumn<String> weatherSummary = GeneratedColumn<String>(
    'weather_summary',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _memoMeta = const VerificationMeta('memo');
  @override
  late final GeneratedColumn<String> memo = GeneratedColumn<String>(
    'memo',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _recordedAtMeta = const VerificationMeta(
    'recordedAt',
  );
  @override
  late final GeneratedColumn<DateTime> recordedAt = GeneratedColumn<DateTime>(
    'recorded_at',
    aliasedName,
    false,
    type: DriftSqlType.dateTime,
    requiredDuringInsert: false,
    defaultValue: currentDateAndTime,
  );
  static const VerificationMeta _createdAtMeta = const VerificationMeta(
    'createdAt',
  );
  @override
  late final GeneratedColumn<DateTime> createdAt = GeneratedColumn<DateTime>(
    'created_at',
    aliasedName,
    false,
    type: DriftSqlType.dateTime,
    requiredDuringInsert: false,
    defaultValue: currentDateAndTime,
  );
  @override
  List<GeneratedColumn> get $columns => [
    fashionId,
    userId,
    photoPath,
    llmAnalysis,
    weatherSummary,
    memo,
    recordedAt,
    createdAt,
  ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'fashion_records';
  @override
  VerificationContext validateIntegrity(
    Insertable<FashionRecord> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('fashion_id')) {
      context.handle(
        _fashionIdMeta,
        fashionId.isAcceptableOrUnknown(data['fashion_id']!, _fashionIdMeta),
      );
    } else if (isInserting) {
      context.missing(_fashionIdMeta);
    }
    if (data.containsKey('user_id')) {
      context.handle(
        _userIdMeta,
        userId.isAcceptableOrUnknown(data['user_id']!, _userIdMeta),
      );
    } else if (isInserting) {
      context.missing(_userIdMeta);
    }
    if (data.containsKey('photo_path')) {
      context.handle(
        _photoPathMeta,
        photoPath.isAcceptableOrUnknown(data['photo_path']!, _photoPathMeta),
      );
    }
    if (data.containsKey('llm_analysis')) {
      context.handle(
        _llmAnalysisMeta,
        llmAnalysis.isAcceptableOrUnknown(
          data['llm_analysis']!,
          _llmAnalysisMeta,
        ),
      );
    }
    if (data.containsKey('weather_summary')) {
      context.handle(
        _weatherSummaryMeta,
        weatherSummary.isAcceptableOrUnknown(
          data['weather_summary']!,
          _weatherSummaryMeta,
        ),
      );
    }
    if (data.containsKey('memo')) {
      context.handle(
        _memoMeta,
        memo.isAcceptableOrUnknown(data['memo']!, _memoMeta),
      );
    }
    if (data.containsKey('recorded_at')) {
      context.handle(
        _recordedAtMeta,
        recordedAt.isAcceptableOrUnknown(data['recorded_at']!, _recordedAtMeta),
      );
    }
    if (data.containsKey('created_at')) {
      context.handle(
        _createdAtMeta,
        createdAt.isAcceptableOrUnknown(data['created_at']!, _createdAtMeta),
      );
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {fashionId};
  @override
  FashionRecord map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return FashionRecord(
      fashionId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}fashion_id'],
      )!,
      userId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}user_id'],
      )!,
      photoPath: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}photo_path'],
      ),
      llmAnalysis: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}llm_analysis'],
      ),
      weatherSummary: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}weather_summary'],
      ),
      memo: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}memo'],
      ),
      recordedAt: attachedDatabase.typeMapping.read(
        DriftSqlType.dateTime,
        data['${effectivePrefix}recorded_at'],
      )!,
      createdAt: attachedDatabase.typeMapping.read(
        DriftSqlType.dateTime,
        data['${effectivePrefix}created_at'],
      )!,
    );
  }

  @override
  $FashionRecordsTable createAlias(String alias) {
    return $FashionRecordsTable(attachedDatabase, alias);
  }
}

class FashionRecord extends DataClass implements Insertable<FashionRecord> {
  final String fashionId;
  final String userId;
  final String? photoPath;
  final String? llmAnalysis;
  final String? weatherSummary;
  final String? memo;
  final DateTime recordedAt;
  final DateTime createdAt;
  const FashionRecord({
    required this.fashionId,
    required this.userId,
    this.photoPath,
    this.llmAnalysis,
    this.weatherSummary,
    this.memo,
    required this.recordedAt,
    required this.createdAt,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['fashion_id'] = Variable<String>(fashionId);
    map['user_id'] = Variable<String>(userId);
    if (!nullToAbsent || photoPath != null) {
      map['photo_path'] = Variable<String>(photoPath);
    }
    if (!nullToAbsent || llmAnalysis != null) {
      map['llm_analysis'] = Variable<String>(llmAnalysis);
    }
    if (!nullToAbsent || weatherSummary != null) {
      map['weather_summary'] = Variable<String>(weatherSummary);
    }
    if (!nullToAbsent || memo != null) {
      map['memo'] = Variable<String>(memo);
    }
    map['recorded_at'] = Variable<DateTime>(recordedAt);
    map['created_at'] = Variable<DateTime>(createdAt);
    return map;
  }

  FashionRecordsCompanion toCompanion(bool nullToAbsent) {
    return FashionRecordsCompanion(
      fashionId: Value(fashionId),
      userId: Value(userId),
      photoPath: photoPath == null && nullToAbsent
          ? const Value.absent()
          : Value(photoPath),
      llmAnalysis: llmAnalysis == null && nullToAbsent
          ? const Value.absent()
          : Value(llmAnalysis),
      weatherSummary: weatherSummary == null && nullToAbsent
          ? const Value.absent()
          : Value(weatherSummary),
      memo: memo == null && nullToAbsent ? const Value.absent() : Value(memo),
      recordedAt: Value(recordedAt),
      createdAt: Value(createdAt),
    );
  }

  factory FashionRecord.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return FashionRecord(
      fashionId: serializer.fromJson<String>(json['fashionId']),
      userId: serializer.fromJson<String>(json['userId']),
      photoPath: serializer.fromJson<String?>(json['photoPath']),
      llmAnalysis: serializer.fromJson<String?>(json['llmAnalysis']),
      weatherSummary: serializer.fromJson<String?>(json['weatherSummary']),
      memo: serializer.fromJson<String?>(json['memo']),
      recordedAt: serializer.fromJson<DateTime>(json['recordedAt']),
      createdAt: serializer.fromJson<DateTime>(json['createdAt']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'fashionId': serializer.toJson<String>(fashionId),
      'userId': serializer.toJson<String>(userId),
      'photoPath': serializer.toJson<String?>(photoPath),
      'llmAnalysis': serializer.toJson<String?>(llmAnalysis),
      'weatherSummary': serializer.toJson<String?>(weatherSummary),
      'memo': serializer.toJson<String?>(memo),
      'recordedAt': serializer.toJson<DateTime>(recordedAt),
      'createdAt': serializer.toJson<DateTime>(createdAt),
    };
  }

  FashionRecord copyWith({
    String? fashionId,
    String? userId,
    Value<String?> photoPath = const Value.absent(),
    Value<String?> llmAnalysis = const Value.absent(),
    Value<String?> weatherSummary = const Value.absent(),
    Value<String?> memo = const Value.absent(),
    DateTime? recordedAt,
    DateTime? createdAt,
  }) => FashionRecord(
    fashionId: fashionId ?? this.fashionId,
    userId: userId ?? this.userId,
    photoPath: photoPath.present ? photoPath.value : this.photoPath,
    llmAnalysis: llmAnalysis.present ? llmAnalysis.value : this.llmAnalysis,
    weatherSummary: weatherSummary.present
        ? weatherSummary.value
        : this.weatherSummary,
    memo: memo.present ? memo.value : this.memo,
    recordedAt: recordedAt ?? this.recordedAt,
    createdAt: createdAt ?? this.createdAt,
  );
  FashionRecord copyWithCompanion(FashionRecordsCompanion data) {
    return FashionRecord(
      fashionId: data.fashionId.present ? data.fashionId.value : this.fashionId,
      userId: data.userId.present ? data.userId.value : this.userId,
      photoPath: data.photoPath.present ? data.photoPath.value : this.photoPath,
      llmAnalysis: data.llmAnalysis.present
          ? data.llmAnalysis.value
          : this.llmAnalysis,
      weatherSummary: data.weatherSummary.present
          ? data.weatherSummary.value
          : this.weatherSummary,
      memo: data.memo.present ? data.memo.value : this.memo,
      recordedAt: data.recordedAt.present
          ? data.recordedAt.value
          : this.recordedAt,
      createdAt: data.createdAt.present ? data.createdAt.value : this.createdAt,
    );
  }

  @override
  String toString() {
    return (StringBuffer('FashionRecord(')
          ..write('fashionId: $fashionId, ')
          ..write('userId: $userId, ')
          ..write('photoPath: $photoPath, ')
          ..write('llmAnalysis: $llmAnalysis, ')
          ..write('weatherSummary: $weatherSummary, ')
          ..write('memo: $memo, ')
          ..write('recordedAt: $recordedAt, ')
          ..write('createdAt: $createdAt')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(
    fashionId,
    userId,
    photoPath,
    llmAnalysis,
    weatherSummary,
    memo,
    recordedAt,
    createdAt,
  );
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is FashionRecord &&
          other.fashionId == this.fashionId &&
          other.userId == this.userId &&
          other.photoPath == this.photoPath &&
          other.llmAnalysis == this.llmAnalysis &&
          other.weatherSummary == this.weatherSummary &&
          other.memo == this.memo &&
          other.recordedAt == this.recordedAt &&
          other.createdAt == this.createdAt);
}

class FashionRecordsCompanion extends UpdateCompanion<FashionRecord> {
  final Value<String> fashionId;
  final Value<String> userId;
  final Value<String?> photoPath;
  final Value<String?> llmAnalysis;
  final Value<String?> weatherSummary;
  final Value<String?> memo;
  final Value<DateTime> recordedAt;
  final Value<DateTime> createdAt;
  final Value<int> rowid;
  const FashionRecordsCompanion({
    this.fashionId = const Value.absent(),
    this.userId = const Value.absent(),
    this.photoPath = const Value.absent(),
    this.llmAnalysis = const Value.absent(),
    this.weatherSummary = const Value.absent(),
    this.memo = const Value.absent(),
    this.recordedAt = const Value.absent(),
    this.createdAt = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  FashionRecordsCompanion.insert({
    required String fashionId,
    required String userId,
    this.photoPath = const Value.absent(),
    this.llmAnalysis = const Value.absent(),
    this.weatherSummary = const Value.absent(),
    this.memo = const Value.absent(),
    this.recordedAt = const Value.absent(),
    this.createdAt = const Value.absent(),
    this.rowid = const Value.absent(),
  }) : fashionId = Value(fashionId),
       userId = Value(userId);
  static Insertable<FashionRecord> custom({
    Expression<String>? fashionId,
    Expression<String>? userId,
    Expression<String>? photoPath,
    Expression<String>? llmAnalysis,
    Expression<String>? weatherSummary,
    Expression<String>? memo,
    Expression<DateTime>? recordedAt,
    Expression<DateTime>? createdAt,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (fashionId != null) 'fashion_id': fashionId,
      if (userId != null) 'user_id': userId,
      if (photoPath != null) 'photo_path': photoPath,
      if (llmAnalysis != null) 'llm_analysis': llmAnalysis,
      if (weatherSummary != null) 'weather_summary': weatherSummary,
      if (memo != null) 'memo': memo,
      if (recordedAt != null) 'recorded_at': recordedAt,
      if (createdAt != null) 'created_at': createdAt,
      if (rowid != null) 'rowid': rowid,
    });
  }

  FashionRecordsCompanion copyWith({
    Value<String>? fashionId,
    Value<String>? userId,
    Value<String?>? photoPath,
    Value<String?>? llmAnalysis,
    Value<String?>? weatherSummary,
    Value<String?>? memo,
    Value<DateTime>? recordedAt,
    Value<DateTime>? createdAt,
    Value<int>? rowid,
  }) {
    return FashionRecordsCompanion(
      fashionId: fashionId ?? this.fashionId,
      userId: userId ?? this.userId,
      photoPath: photoPath ?? this.photoPath,
      llmAnalysis: llmAnalysis ?? this.llmAnalysis,
      weatherSummary: weatherSummary ?? this.weatherSummary,
      memo: memo ?? this.memo,
      recordedAt: recordedAt ?? this.recordedAt,
      createdAt: createdAt ?? this.createdAt,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (fashionId.present) {
      map['fashion_id'] = Variable<String>(fashionId.value);
    }
    if (userId.present) {
      map['user_id'] = Variable<String>(userId.value);
    }
    if (photoPath.present) {
      map['photo_path'] = Variable<String>(photoPath.value);
    }
    if (llmAnalysis.present) {
      map['llm_analysis'] = Variable<String>(llmAnalysis.value);
    }
    if (weatherSummary.present) {
      map['weather_summary'] = Variable<String>(weatherSummary.value);
    }
    if (memo.present) {
      map['memo'] = Variable<String>(memo.value);
    }
    if (recordedAt.present) {
      map['recorded_at'] = Variable<DateTime>(recordedAt.value);
    }
    if (createdAt.present) {
      map['created_at'] = Variable<DateTime>(createdAt.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('FashionRecordsCompanion(')
          ..write('fashionId: $fashionId, ')
          ..write('userId: $userId, ')
          ..write('photoPath: $photoPath, ')
          ..write('llmAnalysis: $llmAnalysis, ')
          ..write('weatherSummary: $weatherSummary, ')
          ..write('memo: $memo, ')
          ..write('recordedAt: $recordedAt, ')
          ..write('createdAt: $createdAt, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $PrepareItemsTable extends PrepareItems
    with TableInfo<$PrepareItemsTable, PrepareItem> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $PrepareItemsTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _prepareIdMeta = const VerificationMeta(
    'prepareId',
  );
  @override
  late final GeneratedColumn<String> prepareId = GeneratedColumn<String>(
    'prepare_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _userIdMeta = const VerificationMeta('userId');
  @override
  late final GeneratedColumn<String> userId = GeneratedColumn<String>(
    'user_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _targetDateMeta = const VerificationMeta(
    'targetDate',
  );
  @override
  late final GeneratedColumn<String> targetDate = GeneratedColumn<String>(
    'target_date',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _titleMeta = const VerificationMeta('title');
  @override
  late final GeneratedColumn<String> title = GeneratedColumn<String>(
    'title',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _itemsJsonMeta = const VerificationMeta(
    'itemsJson',
  );
  @override
  late final GeneratedColumn<String> itemsJson = GeneratedColumn<String>(
    'items_json',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _isNotifiedMeta = const VerificationMeta(
    'isNotified',
  );
  @override
  late final GeneratedColumn<bool> isNotified = GeneratedColumn<bool>(
    'is_notified',
    aliasedName,
    false,
    type: DriftSqlType.bool,
    requiredDuringInsert: false,
    defaultConstraints: GeneratedColumn.constraintIsAlways(
      'CHECK ("is_notified" IN (0, 1))',
    ),
    defaultValue: const Constant(false),
  );
  static const VerificationMeta _createdAtMeta = const VerificationMeta(
    'createdAt',
  );
  @override
  late final GeneratedColumn<DateTime> createdAt = GeneratedColumn<DateTime>(
    'created_at',
    aliasedName,
    false,
    type: DriftSqlType.dateTime,
    requiredDuringInsert: false,
    defaultValue: currentDateAndTime,
  );
  @override
  List<GeneratedColumn> get $columns => [
    prepareId,
    userId,
    targetDate,
    title,
    itemsJson,
    isNotified,
    createdAt,
  ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'prepare_items';
  @override
  VerificationContext validateIntegrity(
    Insertable<PrepareItem> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('prepare_id')) {
      context.handle(
        _prepareIdMeta,
        prepareId.isAcceptableOrUnknown(data['prepare_id']!, _prepareIdMeta),
      );
    } else if (isInserting) {
      context.missing(_prepareIdMeta);
    }
    if (data.containsKey('user_id')) {
      context.handle(
        _userIdMeta,
        userId.isAcceptableOrUnknown(data['user_id']!, _userIdMeta),
      );
    } else if (isInserting) {
      context.missing(_userIdMeta);
    }
    if (data.containsKey('target_date')) {
      context.handle(
        _targetDateMeta,
        targetDate.isAcceptableOrUnknown(data['target_date']!, _targetDateMeta),
      );
    } else if (isInserting) {
      context.missing(_targetDateMeta);
    }
    if (data.containsKey('title')) {
      context.handle(
        _titleMeta,
        title.isAcceptableOrUnknown(data['title']!, _titleMeta),
      );
    } else if (isInserting) {
      context.missing(_titleMeta);
    }
    if (data.containsKey('items_json')) {
      context.handle(
        _itemsJsonMeta,
        itemsJson.isAcceptableOrUnknown(data['items_json']!, _itemsJsonMeta),
      );
    } else if (isInserting) {
      context.missing(_itemsJsonMeta);
    }
    if (data.containsKey('is_notified')) {
      context.handle(
        _isNotifiedMeta,
        isNotified.isAcceptableOrUnknown(data['is_notified']!, _isNotifiedMeta),
      );
    }
    if (data.containsKey('created_at')) {
      context.handle(
        _createdAtMeta,
        createdAt.isAcceptableOrUnknown(data['created_at']!, _createdAtMeta),
      );
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {prepareId};
  @override
  PrepareItem map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return PrepareItem(
      prepareId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}prepare_id'],
      )!,
      userId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}user_id'],
      )!,
      targetDate: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}target_date'],
      )!,
      title: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}title'],
      )!,
      itemsJson: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}items_json'],
      )!,
      isNotified: attachedDatabase.typeMapping.read(
        DriftSqlType.bool,
        data['${effectivePrefix}is_notified'],
      )!,
      createdAt: attachedDatabase.typeMapping.read(
        DriftSqlType.dateTime,
        data['${effectivePrefix}created_at'],
      )!,
    );
  }

  @override
  $PrepareItemsTable createAlias(String alias) {
    return $PrepareItemsTable(attachedDatabase, alias);
  }
}

class PrepareItem extends DataClass implements Insertable<PrepareItem> {
  final String prepareId;
  final String userId;
  final String targetDate;
  final String title;
  final String itemsJson;
  final bool isNotified;
  final DateTime createdAt;
  const PrepareItem({
    required this.prepareId,
    required this.userId,
    required this.targetDate,
    required this.title,
    required this.itemsJson,
    required this.isNotified,
    required this.createdAt,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['prepare_id'] = Variable<String>(prepareId);
    map['user_id'] = Variable<String>(userId);
    map['target_date'] = Variable<String>(targetDate);
    map['title'] = Variable<String>(title);
    map['items_json'] = Variable<String>(itemsJson);
    map['is_notified'] = Variable<bool>(isNotified);
    map['created_at'] = Variable<DateTime>(createdAt);
    return map;
  }

  PrepareItemsCompanion toCompanion(bool nullToAbsent) {
    return PrepareItemsCompanion(
      prepareId: Value(prepareId),
      userId: Value(userId),
      targetDate: Value(targetDate),
      title: Value(title),
      itemsJson: Value(itemsJson),
      isNotified: Value(isNotified),
      createdAt: Value(createdAt),
    );
  }

  factory PrepareItem.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return PrepareItem(
      prepareId: serializer.fromJson<String>(json['prepareId']),
      userId: serializer.fromJson<String>(json['userId']),
      targetDate: serializer.fromJson<String>(json['targetDate']),
      title: serializer.fromJson<String>(json['title']),
      itemsJson: serializer.fromJson<String>(json['itemsJson']),
      isNotified: serializer.fromJson<bool>(json['isNotified']),
      createdAt: serializer.fromJson<DateTime>(json['createdAt']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'prepareId': serializer.toJson<String>(prepareId),
      'userId': serializer.toJson<String>(userId),
      'targetDate': serializer.toJson<String>(targetDate),
      'title': serializer.toJson<String>(title),
      'itemsJson': serializer.toJson<String>(itemsJson),
      'isNotified': serializer.toJson<bool>(isNotified),
      'createdAt': serializer.toJson<DateTime>(createdAt),
    };
  }

  PrepareItem copyWith({
    String? prepareId,
    String? userId,
    String? targetDate,
    String? title,
    String? itemsJson,
    bool? isNotified,
    DateTime? createdAt,
  }) => PrepareItem(
    prepareId: prepareId ?? this.prepareId,
    userId: userId ?? this.userId,
    targetDate: targetDate ?? this.targetDate,
    title: title ?? this.title,
    itemsJson: itemsJson ?? this.itemsJson,
    isNotified: isNotified ?? this.isNotified,
    createdAt: createdAt ?? this.createdAt,
  );
  PrepareItem copyWithCompanion(PrepareItemsCompanion data) {
    return PrepareItem(
      prepareId: data.prepareId.present ? data.prepareId.value : this.prepareId,
      userId: data.userId.present ? data.userId.value : this.userId,
      targetDate: data.targetDate.present
          ? data.targetDate.value
          : this.targetDate,
      title: data.title.present ? data.title.value : this.title,
      itemsJson: data.itemsJson.present ? data.itemsJson.value : this.itemsJson,
      isNotified: data.isNotified.present
          ? data.isNotified.value
          : this.isNotified,
      createdAt: data.createdAt.present ? data.createdAt.value : this.createdAt,
    );
  }

  @override
  String toString() {
    return (StringBuffer('PrepareItem(')
          ..write('prepareId: $prepareId, ')
          ..write('userId: $userId, ')
          ..write('targetDate: $targetDate, ')
          ..write('title: $title, ')
          ..write('itemsJson: $itemsJson, ')
          ..write('isNotified: $isNotified, ')
          ..write('createdAt: $createdAt')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(
    prepareId,
    userId,
    targetDate,
    title,
    itemsJson,
    isNotified,
    createdAt,
  );
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is PrepareItem &&
          other.prepareId == this.prepareId &&
          other.userId == this.userId &&
          other.targetDate == this.targetDate &&
          other.title == this.title &&
          other.itemsJson == this.itemsJson &&
          other.isNotified == this.isNotified &&
          other.createdAt == this.createdAt);
}

class PrepareItemsCompanion extends UpdateCompanion<PrepareItem> {
  final Value<String> prepareId;
  final Value<String> userId;
  final Value<String> targetDate;
  final Value<String> title;
  final Value<String> itemsJson;
  final Value<bool> isNotified;
  final Value<DateTime> createdAt;
  final Value<int> rowid;
  const PrepareItemsCompanion({
    this.prepareId = const Value.absent(),
    this.userId = const Value.absent(),
    this.targetDate = const Value.absent(),
    this.title = const Value.absent(),
    this.itemsJson = const Value.absent(),
    this.isNotified = const Value.absent(),
    this.createdAt = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  PrepareItemsCompanion.insert({
    required String prepareId,
    required String userId,
    required String targetDate,
    required String title,
    required String itemsJson,
    this.isNotified = const Value.absent(),
    this.createdAt = const Value.absent(),
    this.rowid = const Value.absent(),
  }) : prepareId = Value(prepareId),
       userId = Value(userId),
       targetDate = Value(targetDate),
       title = Value(title),
       itemsJson = Value(itemsJson);
  static Insertable<PrepareItem> custom({
    Expression<String>? prepareId,
    Expression<String>? userId,
    Expression<String>? targetDate,
    Expression<String>? title,
    Expression<String>? itemsJson,
    Expression<bool>? isNotified,
    Expression<DateTime>? createdAt,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (prepareId != null) 'prepare_id': prepareId,
      if (userId != null) 'user_id': userId,
      if (targetDate != null) 'target_date': targetDate,
      if (title != null) 'title': title,
      if (itemsJson != null) 'items_json': itemsJson,
      if (isNotified != null) 'is_notified': isNotified,
      if (createdAt != null) 'created_at': createdAt,
      if (rowid != null) 'rowid': rowid,
    });
  }

  PrepareItemsCompanion copyWith({
    Value<String>? prepareId,
    Value<String>? userId,
    Value<String>? targetDate,
    Value<String>? title,
    Value<String>? itemsJson,
    Value<bool>? isNotified,
    Value<DateTime>? createdAt,
    Value<int>? rowid,
  }) {
    return PrepareItemsCompanion(
      prepareId: prepareId ?? this.prepareId,
      userId: userId ?? this.userId,
      targetDate: targetDate ?? this.targetDate,
      title: title ?? this.title,
      itemsJson: itemsJson ?? this.itemsJson,
      isNotified: isNotified ?? this.isNotified,
      createdAt: createdAt ?? this.createdAt,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (prepareId.present) {
      map['prepare_id'] = Variable<String>(prepareId.value);
    }
    if (userId.present) {
      map['user_id'] = Variable<String>(userId.value);
    }
    if (targetDate.present) {
      map['target_date'] = Variable<String>(targetDate.value);
    }
    if (title.present) {
      map['title'] = Variable<String>(title.value);
    }
    if (itemsJson.present) {
      map['items_json'] = Variable<String>(itemsJson.value);
    }
    if (isNotified.present) {
      map['is_notified'] = Variable<bool>(isNotified.value);
    }
    if (createdAt.present) {
      map['created_at'] = Variable<DateTime>(createdAt.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('PrepareItemsCompanion(')
          ..write('prepareId: $prepareId, ')
          ..write('userId: $userId, ')
          ..write('targetDate: $targetDate, ')
          ..write('title: $title, ')
          ..write('itemsJson: $itemsJson, ')
          ..write('isNotified: $isNotified, ')
          ..write('createdAt: $createdAt, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $SubscriptionItemsTable extends SubscriptionItems
    with TableInfo<$SubscriptionItemsTable, SubscriptionItem> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $SubscriptionItemsTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _subscriptionIdMeta = const VerificationMeta(
    'subscriptionId',
  );
  @override
  late final GeneratedColumn<String> subscriptionId = GeneratedColumn<String>(
    'subscription_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _userIdMeta = const VerificationMeta('userId');
  @override
  late final GeneratedColumn<String> userId = GeneratedColumn<String>(
    'user_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _nameMeta = const VerificationMeta('name');
  @override
  late final GeneratedColumn<String> name = GeneratedColumn<String>(
    'name',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _amountMeta = const VerificationMeta('amount');
  @override
  late final GeneratedColumn<int> amount = GeneratedColumn<int>(
    'amount',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _cycleMeta = const VerificationMeta('cycle');
  @override
  late final GeneratedColumn<String> cycle = GeneratedColumn<String>(
    'cycle',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
    defaultValue: const Constant('monthly'),
  );
  static const VerificationMeta _billingDayMeta = const VerificationMeta(
    'billingDay',
  );
  @override
  late final GeneratedColumn<int> billingDay = GeneratedColumn<int>(
    'billing_day',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _alertDaysBeforeMeta = const VerificationMeta(
    'alertDaysBefore',
  );
  @override
  late final GeneratedColumn<int> alertDaysBefore = GeneratedColumn<int>(
    'alert_days_before',
    aliasedName,
    true,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _categoryMeta = const VerificationMeta(
    'category',
  );
  @override
  late final GeneratedColumn<String> category = GeneratedColumn<String>(
    'category',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _isActiveMeta = const VerificationMeta(
    'isActive',
  );
  @override
  late final GeneratedColumn<bool> isActive = GeneratedColumn<bool>(
    'is_active',
    aliasedName,
    false,
    type: DriftSqlType.bool,
    requiredDuringInsert: false,
    defaultConstraints: GeneratedColumn.constraintIsAlways(
      'CHECK ("is_active" IN (0, 1))',
    ),
    defaultValue: const Constant(true),
  );
  static const VerificationMeta _lastBilledDateMeta = const VerificationMeta(
    'lastBilledDate',
  );
  @override
  late final GeneratedColumn<DateTime> lastBilledDate =
      GeneratedColumn<DateTime>(
        'last_billed_date',
        aliasedName,
        true,
        type: DriftSqlType.dateTime,
        requiredDuringInsert: false,
      );
  static const VerificationMeta _createdAtMeta = const VerificationMeta(
    'createdAt',
  );
  @override
  late final GeneratedColumn<DateTime> createdAt = GeneratedColumn<DateTime>(
    'created_at',
    aliasedName,
    false,
    type: DriftSqlType.dateTime,
    requiredDuringInsert: false,
    defaultValue: currentDateAndTime,
  );
  @override
  List<GeneratedColumn> get $columns => [
    subscriptionId,
    userId,
    name,
    amount,
    cycle,
    billingDay,
    alertDaysBefore,
    category,
    isActive,
    lastBilledDate,
    createdAt,
  ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'subscription_items';
  @override
  VerificationContext validateIntegrity(
    Insertable<SubscriptionItem> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('subscription_id')) {
      context.handle(
        _subscriptionIdMeta,
        subscriptionId.isAcceptableOrUnknown(
          data['subscription_id']!,
          _subscriptionIdMeta,
        ),
      );
    } else if (isInserting) {
      context.missing(_subscriptionIdMeta);
    }
    if (data.containsKey('user_id')) {
      context.handle(
        _userIdMeta,
        userId.isAcceptableOrUnknown(data['user_id']!, _userIdMeta),
      );
    } else if (isInserting) {
      context.missing(_userIdMeta);
    }
    if (data.containsKey('name')) {
      context.handle(
        _nameMeta,
        name.isAcceptableOrUnknown(data['name']!, _nameMeta),
      );
    } else if (isInserting) {
      context.missing(_nameMeta);
    }
    if (data.containsKey('amount')) {
      context.handle(
        _amountMeta,
        amount.isAcceptableOrUnknown(data['amount']!, _amountMeta),
      );
    } else if (isInserting) {
      context.missing(_amountMeta);
    }
    if (data.containsKey('cycle')) {
      context.handle(
        _cycleMeta,
        cycle.isAcceptableOrUnknown(data['cycle']!, _cycleMeta),
      );
    }
    if (data.containsKey('billing_day')) {
      context.handle(
        _billingDayMeta,
        billingDay.isAcceptableOrUnknown(data['billing_day']!, _billingDayMeta),
      );
    } else if (isInserting) {
      context.missing(_billingDayMeta);
    }
    if (data.containsKey('alert_days_before')) {
      context.handle(
        _alertDaysBeforeMeta,
        alertDaysBefore.isAcceptableOrUnknown(
          data['alert_days_before']!,
          _alertDaysBeforeMeta,
        ),
      );
    }
    if (data.containsKey('category')) {
      context.handle(
        _categoryMeta,
        category.isAcceptableOrUnknown(data['category']!, _categoryMeta),
      );
    }
    if (data.containsKey('is_active')) {
      context.handle(
        _isActiveMeta,
        isActive.isAcceptableOrUnknown(data['is_active']!, _isActiveMeta),
      );
    }
    if (data.containsKey('last_billed_date')) {
      context.handle(
        _lastBilledDateMeta,
        lastBilledDate.isAcceptableOrUnknown(
          data['last_billed_date']!,
          _lastBilledDateMeta,
        ),
      );
    }
    if (data.containsKey('created_at')) {
      context.handle(
        _createdAtMeta,
        createdAt.isAcceptableOrUnknown(data['created_at']!, _createdAtMeta),
      );
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {subscriptionId};
  @override
  SubscriptionItem map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return SubscriptionItem(
      subscriptionId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}subscription_id'],
      )!,
      userId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}user_id'],
      )!,
      name: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}name'],
      )!,
      amount: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}amount'],
      )!,
      cycle: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}cycle'],
      )!,
      billingDay: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}billing_day'],
      )!,
      alertDaysBefore: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}alert_days_before'],
      ),
      category: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}category'],
      ),
      isActive: attachedDatabase.typeMapping.read(
        DriftSqlType.bool,
        data['${effectivePrefix}is_active'],
      )!,
      lastBilledDate: attachedDatabase.typeMapping.read(
        DriftSqlType.dateTime,
        data['${effectivePrefix}last_billed_date'],
      ),
      createdAt: attachedDatabase.typeMapping.read(
        DriftSqlType.dateTime,
        data['${effectivePrefix}created_at'],
      )!,
    );
  }

  @override
  $SubscriptionItemsTable createAlias(String alias) {
    return $SubscriptionItemsTable(attachedDatabase, alias);
  }
}

class SubscriptionItem extends DataClass
    implements Insertable<SubscriptionItem> {
  final String subscriptionId;
  final String userId;
  final String name;
  final int amount;
  final String cycle;
  final int billingDay;
  final int? alertDaysBefore;
  final String? category;
  final bool isActive;
  final DateTime? lastBilledDate;
  final DateTime createdAt;
  const SubscriptionItem({
    required this.subscriptionId,
    required this.userId,
    required this.name,
    required this.amount,
    required this.cycle,
    required this.billingDay,
    this.alertDaysBefore,
    this.category,
    required this.isActive,
    this.lastBilledDate,
    required this.createdAt,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['subscription_id'] = Variable<String>(subscriptionId);
    map['user_id'] = Variable<String>(userId);
    map['name'] = Variable<String>(name);
    map['amount'] = Variable<int>(amount);
    map['cycle'] = Variable<String>(cycle);
    map['billing_day'] = Variable<int>(billingDay);
    if (!nullToAbsent || alertDaysBefore != null) {
      map['alert_days_before'] = Variable<int>(alertDaysBefore);
    }
    if (!nullToAbsent || category != null) {
      map['category'] = Variable<String>(category);
    }
    map['is_active'] = Variable<bool>(isActive);
    if (!nullToAbsent || lastBilledDate != null) {
      map['last_billed_date'] = Variable<DateTime>(lastBilledDate);
    }
    map['created_at'] = Variable<DateTime>(createdAt);
    return map;
  }

  SubscriptionItemsCompanion toCompanion(bool nullToAbsent) {
    return SubscriptionItemsCompanion(
      subscriptionId: Value(subscriptionId),
      userId: Value(userId),
      name: Value(name),
      amount: Value(amount),
      cycle: Value(cycle),
      billingDay: Value(billingDay),
      alertDaysBefore: alertDaysBefore == null && nullToAbsent
          ? const Value.absent()
          : Value(alertDaysBefore),
      category: category == null && nullToAbsent
          ? const Value.absent()
          : Value(category),
      isActive: Value(isActive),
      lastBilledDate: lastBilledDate == null && nullToAbsent
          ? const Value.absent()
          : Value(lastBilledDate),
      createdAt: Value(createdAt),
    );
  }

  factory SubscriptionItem.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return SubscriptionItem(
      subscriptionId: serializer.fromJson<String>(json['subscriptionId']),
      userId: serializer.fromJson<String>(json['userId']),
      name: serializer.fromJson<String>(json['name']),
      amount: serializer.fromJson<int>(json['amount']),
      cycle: serializer.fromJson<String>(json['cycle']),
      billingDay: serializer.fromJson<int>(json['billingDay']),
      alertDaysBefore: serializer.fromJson<int?>(json['alertDaysBefore']),
      category: serializer.fromJson<String?>(json['category']),
      isActive: serializer.fromJson<bool>(json['isActive']),
      lastBilledDate: serializer.fromJson<DateTime?>(json['lastBilledDate']),
      createdAt: serializer.fromJson<DateTime>(json['createdAt']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'subscriptionId': serializer.toJson<String>(subscriptionId),
      'userId': serializer.toJson<String>(userId),
      'name': serializer.toJson<String>(name),
      'amount': serializer.toJson<int>(amount),
      'cycle': serializer.toJson<String>(cycle),
      'billingDay': serializer.toJson<int>(billingDay),
      'alertDaysBefore': serializer.toJson<int?>(alertDaysBefore),
      'category': serializer.toJson<String?>(category),
      'isActive': serializer.toJson<bool>(isActive),
      'lastBilledDate': serializer.toJson<DateTime?>(lastBilledDate),
      'createdAt': serializer.toJson<DateTime>(createdAt),
    };
  }

  SubscriptionItem copyWith({
    String? subscriptionId,
    String? userId,
    String? name,
    int? amount,
    String? cycle,
    int? billingDay,
    Value<int?> alertDaysBefore = const Value.absent(),
    Value<String?> category = const Value.absent(),
    bool? isActive,
    Value<DateTime?> lastBilledDate = const Value.absent(),
    DateTime? createdAt,
  }) => SubscriptionItem(
    subscriptionId: subscriptionId ?? this.subscriptionId,
    userId: userId ?? this.userId,
    name: name ?? this.name,
    amount: amount ?? this.amount,
    cycle: cycle ?? this.cycle,
    billingDay: billingDay ?? this.billingDay,
    alertDaysBefore: alertDaysBefore.present
        ? alertDaysBefore.value
        : this.alertDaysBefore,
    category: category.present ? category.value : this.category,
    isActive: isActive ?? this.isActive,
    lastBilledDate: lastBilledDate.present
        ? lastBilledDate.value
        : this.lastBilledDate,
    createdAt: createdAt ?? this.createdAt,
  );
  SubscriptionItem copyWithCompanion(SubscriptionItemsCompanion data) {
    return SubscriptionItem(
      subscriptionId: data.subscriptionId.present
          ? data.subscriptionId.value
          : this.subscriptionId,
      userId: data.userId.present ? data.userId.value : this.userId,
      name: data.name.present ? data.name.value : this.name,
      amount: data.amount.present ? data.amount.value : this.amount,
      cycle: data.cycle.present ? data.cycle.value : this.cycle,
      billingDay: data.billingDay.present
          ? data.billingDay.value
          : this.billingDay,
      alertDaysBefore: data.alertDaysBefore.present
          ? data.alertDaysBefore.value
          : this.alertDaysBefore,
      category: data.category.present ? data.category.value : this.category,
      isActive: data.isActive.present ? data.isActive.value : this.isActive,
      lastBilledDate: data.lastBilledDate.present
          ? data.lastBilledDate.value
          : this.lastBilledDate,
      createdAt: data.createdAt.present ? data.createdAt.value : this.createdAt,
    );
  }

  @override
  String toString() {
    return (StringBuffer('SubscriptionItem(')
          ..write('subscriptionId: $subscriptionId, ')
          ..write('userId: $userId, ')
          ..write('name: $name, ')
          ..write('amount: $amount, ')
          ..write('cycle: $cycle, ')
          ..write('billingDay: $billingDay, ')
          ..write('alertDaysBefore: $alertDaysBefore, ')
          ..write('category: $category, ')
          ..write('isActive: $isActive, ')
          ..write('lastBilledDate: $lastBilledDate, ')
          ..write('createdAt: $createdAt')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(
    subscriptionId,
    userId,
    name,
    amount,
    cycle,
    billingDay,
    alertDaysBefore,
    category,
    isActive,
    lastBilledDate,
    createdAt,
  );
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is SubscriptionItem &&
          other.subscriptionId == this.subscriptionId &&
          other.userId == this.userId &&
          other.name == this.name &&
          other.amount == this.amount &&
          other.cycle == this.cycle &&
          other.billingDay == this.billingDay &&
          other.alertDaysBefore == this.alertDaysBefore &&
          other.category == this.category &&
          other.isActive == this.isActive &&
          other.lastBilledDate == this.lastBilledDate &&
          other.createdAt == this.createdAt);
}

class SubscriptionItemsCompanion extends UpdateCompanion<SubscriptionItem> {
  final Value<String> subscriptionId;
  final Value<String> userId;
  final Value<String> name;
  final Value<int> amount;
  final Value<String> cycle;
  final Value<int> billingDay;
  final Value<int?> alertDaysBefore;
  final Value<String?> category;
  final Value<bool> isActive;
  final Value<DateTime?> lastBilledDate;
  final Value<DateTime> createdAt;
  final Value<int> rowid;
  const SubscriptionItemsCompanion({
    this.subscriptionId = const Value.absent(),
    this.userId = const Value.absent(),
    this.name = const Value.absent(),
    this.amount = const Value.absent(),
    this.cycle = const Value.absent(),
    this.billingDay = const Value.absent(),
    this.alertDaysBefore = const Value.absent(),
    this.category = const Value.absent(),
    this.isActive = const Value.absent(),
    this.lastBilledDate = const Value.absent(),
    this.createdAt = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  SubscriptionItemsCompanion.insert({
    required String subscriptionId,
    required String userId,
    required String name,
    required int amount,
    this.cycle = const Value.absent(),
    required int billingDay,
    this.alertDaysBefore = const Value.absent(),
    this.category = const Value.absent(),
    this.isActive = const Value.absent(),
    this.lastBilledDate = const Value.absent(),
    this.createdAt = const Value.absent(),
    this.rowid = const Value.absent(),
  }) : subscriptionId = Value(subscriptionId),
       userId = Value(userId),
       name = Value(name),
       amount = Value(amount),
       billingDay = Value(billingDay);
  static Insertable<SubscriptionItem> custom({
    Expression<String>? subscriptionId,
    Expression<String>? userId,
    Expression<String>? name,
    Expression<int>? amount,
    Expression<String>? cycle,
    Expression<int>? billingDay,
    Expression<int>? alertDaysBefore,
    Expression<String>? category,
    Expression<bool>? isActive,
    Expression<DateTime>? lastBilledDate,
    Expression<DateTime>? createdAt,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (subscriptionId != null) 'subscription_id': subscriptionId,
      if (userId != null) 'user_id': userId,
      if (name != null) 'name': name,
      if (amount != null) 'amount': amount,
      if (cycle != null) 'cycle': cycle,
      if (billingDay != null) 'billing_day': billingDay,
      if (alertDaysBefore != null) 'alert_days_before': alertDaysBefore,
      if (category != null) 'category': category,
      if (isActive != null) 'is_active': isActive,
      if (lastBilledDate != null) 'last_billed_date': lastBilledDate,
      if (createdAt != null) 'created_at': createdAt,
      if (rowid != null) 'rowid': rowid,
    });
  }

  SubscriptionItemsCompanion copyWith({
    Value<String>? subscriptionId,
    Value<String>? userId,
    Value<String>? name,
    Value<int>? amount,
    Value<String>? cycle,
    Value<int>? billingDay,
    Value<int?>? alertDaysBefore,
    Value<String?>? category,
    Value<bool>? isActive,
    Value<DateTime?>? lastBilledDate,
    Value<DateTime>? createdAt,
    Value<int>? rowid,
  }) {
    return SubscriptionItemsCompanion(
      subscriptionId: subscriptionId ?? this.subscriptionId,
      userId: userId ?? this.userId,
      name: name ?? this.name,
      amount: amount ?? this.amount,
      cycle: cycle ?? this.cycle,
      billingDay: billingDay ?? this.billingDay,
      alertDaysBefore: alertDaysBefore ?? this.alertDaysBefore,
      category: category ?? this.category,
      isActive: isActive ?? this.isActive,
      lastBilledDate: lastBilledDate ?? this.lastBilledDate,
      createdAt: createdAt ?? this.createdAt,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (subscriptionId.present) {
      map['subscription_id'] = Variable<String>(subscriptionId.value);
    }
    if (userId.present) {
      map['user_id'] = Variable<String>(userId.value);
    }
    if (name.present) {
      map['name'] = Variable<String>(name.value);
    }
    if (amount.present) {
      map['amount'] = Variable<int>(amount.value);
    }
    if (cycle.present) {
      map['cycle'] = Variable<String>(cycle.value);
    }
    if (billingDay.present) {
      map['billing_day'] = Variable<int>(billingDay.value);
    }
    if (alertDaysBefore.present) {
      map['alert_days_before'] = Variable<int>(alertDaysBefore.value);
    }
    if (category.present) {
      map['category'] = Variable<String>(category.value);
    }
    if (isActive.present) {
      map['is_active'] = Variable<bool>(isActive.value);
    }
    if (lastBilledDate.present) {
      map['last_billed_date'] = Variable<DateTime>(lastBilledDate.value);
    }
    if (createdAt.present) {
      map['created_at'] = Variable<DateTime>(createdAt.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('SubscriptionItemsCompanion(')
          ..write('subscriptionId: $subscriptionId, ')
          ..write('userId: $userId, ')
          ..write('name: $name, ')
          ..write('amount: $amount, ')
          ..write('cycle: $cycle, ')
          ..write('billingDay: $billingDay, ')
          ..write('alertDaysBefore: $alertDaysBefore, ')
          ..write('category: $category, ')
          ..write('isActive: $isActive, ')
          ..write('lastBilledDate: $lastBilledDate, ')
          ..write('createdAt: $createdAt, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $CaptureItemsTable extends CaptureItems
    with TableInfo<$CaptureItemsTable, CaptureItem> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $CaptureItemsTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _captureIdMeta = const VerificationMeta(
    'captureId',
  );
  @override
  late final GeneratedColumn<String> captureId = GeneratedColumn<String>(
    'capture_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _userIdMeta = const VerificationMeta('userId');
  @override
  late final GeneratedColumn<String> userId = GeneratedColumn<String>(
    'user_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _sourceTypeMeta = const VerificationMeta(
    'sourceType',
  );
  @override
  late final GeneratedColumn<String> sourceType = GeneratedColumn<String>(
    'source_type',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _rawTextMeta = const VerificationMeta(
    'rawText',
  );
  @override
  late final GeneratedColumn<String> rawText = GeneratedColumn<String>(
    'raw_text',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _assetUriMeta = const VerificationMeta(
    'assetUri',
  );
  @override
  late final GeneratedColumn<String> assetUri = GeneratedColumn<String>(
    'asset_uri',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _statusMeta = const VerificationMeta('status');
  @override
  late final GeneratedColumn<String> status = GeneratedColumn<String>(
    'status',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
    defaultValue: const Constant('pending'),
  );
  static const VerificationMeta _createdAtMeta = const VerificationMeta(
    'createdAt',
  );
  @override
  late final GeneratedColumn<DateTime> createdAt = GeneratedColumn<DateTime>(
    'created_at',
    aliasedName,
    false,
    type: DriftSqlType.dateTime,
    requiredDuringInsert: false,
    defaultValue: currentDateAndTime,
  );
  @override
  List<GeneratedColumn> get $columns => [
    captureId,
    userId,
    sourceType,
    rawText,
    assetUri,
    status,
    createdAt,
  ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'capture_items';
  @override
  VerificationContext validateIntegrity(
    Insertable<CaptureItem> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('capture_id')) {
      context.handle(
        _captureIdMeta,
        captureId.isAcceptableOrUnknown(data['capture_id']!, _captureIdMeta),
      );
    } else if (isInserting) {
      context.missing(_captureIdMeta);
    }
    if (data.containsKey('user_id')) {
      context.handle(
        _userIdMeta,
        userId.isAcceptableOrUnknown(data['user_id']!, _userIdMeta),
      );
    } else if (isInserting) {
      context.missing(_userIdMeta);
    }
    if (data.containsKey('source_type')) {
      context.handle(
        _sourceTypeMeta,
        sourceType.isAcceptableOrUnknown(data['source_type']!, _sourceTypeMeta),
      );
    } else if (isInserting) {
      context.missing(_sourceTypeMeta);
    }
    if (data.containsKey('raw_text')) {
      context.handle(
        _rawTextMeta,
        rawText.isAcceptableOrUnknown(data['raw_text']!, _rawTextMeta),
      );
    }
    if (data.containsKey('asset_uri')) {
      context.handle(
        _assetUriMeta,
        assetUri.isAcceptableOrUnknown(data['asset_uri']!, _assetUriMeta),
      );
    }
    if (data.containsKey('status')) {
      context.handle(
        _statusMeta,
        status.isAcceptableOrUnknown(data['status']!, _statusMeta),
      );
    }
    if (data.containsKey('created_at')) {
      context.handle(
        _createdAtMeta,
        createdAt.isAcceptableOrUnknown(data['created_at']!, _createdAtMeta),
      );
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {captureId};
  @override
  CaptureItem map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return CaptureItem(
      captureId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}capture_id'],
      )!,
      userId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}user_id'],
      )!,
      sourceType: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}source_type'],
      )!,
      rawText: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}raw_text'],
      ),
      assetUri: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}asset_uri'],
      ),
      status: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}status'],
      )!,
      createdAt: attachedDatabase.typeMapping.read(
        DriftSqlType.dateTime,
        data['${effectivePrefix}created_at'],
      )!,
    );
  }

  @override
  $CaptureItemsTable createAlias(String alias) {
    return $CaptureItemsTable(attachedDatabase, alias);
  }
}

class CaptureItem extends DataClass implements Insertable<CaptureItem> {
  final String captureId;
  final String userId;
  final String sourceType;
  final String? rawText;
  final String? assetUri;
  final String status;
  final DateTime createdAt;
  const CaptureItem({
    required this.captureId,
    required this.userId,
    required this.sourceType,
    this.rawText,
    this.assetUri,
    required this.status,
    required this.createdAt,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['capture_id'] = Variable<String>(captureId);
    map['user_id'] = Variable<String>(userId);
    map['source_type'] = Variable<String>(sourceType);
    if (!nullToAbsent || rawText != null) {
      map['raw_text'] = Variable<String>(rawText);
    }
    if (!nullToAbsent || assetUri != null) {
      map['asset_uri'] = Variable<String>(assetUri);
    }
    map['status'] = Variable<String>(status);
    map['created_at'] = Variable<DateTime>(createdAt);
    return map;
  }

  CaptureItemsCompanion toCompanion(bool nullToAbsent) {
    return CaptureItemsCompanion(
      captureId: Value(captureId),
      userId: Value(userId),
      sourceType: Value(sourceType),
      rawText: rawText == null && nullToAbsent
          ? const Value.absent()
          : Value(rawText),
      assetUri: assetUri == null && nullToAbsent
          ? const Value.absent()
          : Value(assetUri),
      status: Value(status),
      createdAt: Value(createdAt),
    );
  }

  factory CaptureItem.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return CaptureItem(
      captureId: serializer.fromJson<String>(json['captureId']),
      userId: serializer.fromJson<String>(json['userId']),
      sourceType: serializer.fromJson<String>(json['sourceType']),
      rawText: serializer.fromJson<String?>(json['rawText']),
      assetUri: serializer.fromJson<String?>(json['assetUri']),
      status: serializer.fromJson<String>(json['status']),
      createdAt: serializer.fromJson<DateTime>(json['createdAt']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'captureId': serializer.toJson<String>(captureId),
      'userId': serializer.toJson<String>(userId),
      'sourceType': serializer.toJson<String>(sourceType),
      'rawText': serializer.toJson<String?>(rawText),
      'assetUri': serializer.toJson<String?>(assetUri),
      'status': serializer.toJson<String>(status),
      'createdAt': serializer.toJson<DateTime>(createdAt),
    };
  }

  CaptureItem copyWith({
    String? captureId,
    String? userId,
    String? sourceType,
    Value<String?> rawText = const Value.absent(),
    Value<String?> assetUri = const Value.absent(),
    String? status,
    DateTime? createdAt,
  }) => CaptureItem(
    captureId: captureId ?? this.captureId,
    userId: userId ?? this.userId,
    sourceType: sourceType ?? this.sourceType,
    rawText: rawText.present ? rawText.value : this.rawText,
    assetUri: assetUri.present ? assetUri.value : this.assetUri,
    status: status ?? this.status,
    createdAt: createdAt ?? this.createdAt,
  );
  CaptureItem copyWithCompanion(CaptureItemsCompanion data) {
    return CaptureItem(
      captureId: data.captureId.present ? data.captureId.value : this.captureId,
      userId: data.userId.present ? data.userId.value : this.userId,
      sourceType: data.sourceType.present
          ? data.sourceType.value
          : this.sourceType,
      rawText: data.rawText.present ? data.rawText.value : this.rawText,
      assetUri: data.assetUri.present ? data.assetUri.value : this.assetUri,
      status: data.status.present ? data.status.value : this.status,
      createdAt: data.createdAt.present ? data.createdAt.value : this.createdAt,
    );
  }

  @override
  String toString() {
    return (StringBuffer('CaptureItem(')
          ..write('captureId: $captureId, ')
          ..write('userId: $userId, ')
          ..write('sourceType: $sourceType, ')
          ..write('rawText: $rawText, ')
          ..write('assetUri: $assetUri, ')
          ..write('status: $status, ')
          ..write('createdAt: $createdAt')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(
    captureId,
    userId,
    sourceType,
    rawText,
    assetUri,
    status,
    createdAt,
  );
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is CaptureItem &&
          other.captureId == this.captureId &&
          other.userId == this.userId &&
          other.sourceType == this.sourceType &&
          other.rawText == this.rawText &&
          other.assetUri == this.assetUri &&
          other.status == this.status &&
          other.createdAt == this.createdAt);
}

class CaptureItemsCompanion extends UpdateCompanion<CaptureItem> {
  final Value<String> captureId;
  final Value<String> userId;
  final Value<String> sourceType;
  final Value<String?> rawText;
  final Value<String?> assetUri;
  final Value<String> status;
  final Value<DateTime> createdAt;
  final Value<int> rowid;
  const CaptureItemsCompanion({
    this.captureId = const Value.absent(),
    this.userId = const Value.absent(),
    this.sourceType = const Value.absent(),
    this.rawText = const Value.absent(),
    this.assetUri = const Value.absent(),
    this.status = const Value.absent(),
    this.createdAt = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  CaptureItemsCompanion.insert({
    required String captureId,
    required String userId,
    required String sourceType,
    this.rawText = const Value.absent(),
    this.assetUri = const Value.absent(),
    this.status = const Value.absent(),
    this.createdAt = const Value.absent(),
    this.rowid = const Value.absent(),
  }) : captureId = Value(captureId),
       userId = Value(userId),
       sourceType = Value(sourceType);
  static Insertable<CaptureItem> custom({
    Expression<String>? captureId,
    Expression<String>? userId,
    Expression<String>? sourceType,
    Expression<String>? rawText,
    Expression<String>? assetUri,
    Expression<String>? status,
    Expression<DateTime>? createdAt,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (captureId != null) 'capture_id': captureId,
      if (userId != null) 'user_id': userId,
      if (sourceType != null) 'source_type': sourceType,
      if (rawText != null) 'raw_text': rawText,
      if (assetUri != null) 'asset_uri': assetUri,
      if (status != null) 'status': status,
      if (createdAt != null) 'created_at': createdAt,
      if (rowid != null) 'rowid': rowid,
    });
  }

  CaptureItemsCompanion copyWith({
    Value<String>? captureId,
    Value<String>? userId,
    Value<String>? sourceType,
    Value<String?>? rawText,
    Value<String?>? assetUri,
    Value<String>? status,
    Value<DateTime>? createdAt,
    Value<int>? rowid,
  }) {
    return CaptureItemsCompanion(
      captureId: captureId ?? this.captureId,
      userId: userId ?? this.userId,
      sourceType: sourceType ?? this.sourceType,
      rawText: rawText ?? this.rawText,
      assetUri: assetUri ?? this.assetUri,
      status: status ?? this.status,
      createdAt: createdAt ?? this.createdAt,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (captureId.present) {
      map['capture_id'] = Variable<String>(captureId.value);
    }
    if (userId.present) {
      map['user_id'] = Variable<String>(userId.value);
    }
    if (sourceType.present) {
      map['source_type'] = Variable<String>(sourceType.value);
    }
    if (rawText.present) {
      map['raw_text'] = Variable<String>(rawText.value);
    }
    if (assetUri.present) {
      map['asset_uri'] = Variable<String>(assetUri.value);
    }
    if (status.present) {
      map['status'] = Variable<String>(status.value);
    }
    if (createdAt.present) {
      map['created_at'] = Variable<DateTime>(createdAt.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('CaptureItemsCompanion(')
          ..write('captureId: $captureId, ')
          ..write('userId: $userId, ')
          ..write('sourceType: $sourceType, ')
          ..write('rawText: $rawText, ')
          ..write('assetUri: $assetUri, ')
          ..write('status: $status, ')
          ..write('createdAt: $createdAt, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $ExtractedCapturesTable extends ExtractedCaptures
    with TableInfo<$ExtractedCapturesTable, ExtractedCapture> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $ExtractedCapturesTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _extractedIdMeta = const VerificationMeta(
    'extractedId',
  );
  @override
  late final GeneratedColumn<String> extractedId = GeneratedColumn<String>(
    'extracted_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _captureIdMeta = const VerificationMeta(
    'captureId',
  );
  @override
  late final GeneratedColumn<String> captureId = GeneratedColumn<String>(
    'capture_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _domainMeta = const VerificationMeta('domain');
  @override
  late final GeneratedColumn<String> domain = GeneratedColumn<String>(
    'domain',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _entitiesJsonMeta = const VerificationMeta(
    'entitiesJson',
  );
  @override
  late final GeneratedColumn<String> entitiesJson = GeneratedColumn<String>(
    'entities_json',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _confidenceMeta = const VerificationMeta(
    'confidence',
  );
  @override
  late final GeneratedColumn<double> confidence = GeneratedColumn<double>(
    'confidence',
    aliasedName,
    false,
    type: DriftSqlType.double,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _committedMeta = const VerificationMeta(
    'committed',
  );
  @override
  late final GeneratedColumn<bool> committed = GeneratedColumn<bool>(
    'committed',
    aliasedName,
    false,
    type: DriftSqlType.bool,
    requiredDuringInsert: false,
    defaultConstraints: GeneratedColumn.constraintIsAlways(
      'CHECK ("committed" IN (0, 1))',
    ),
    defaultValue: const Constant(false),
  );
  static const VerificationMeta _createdAtMeta = const VerificationMeta(
    'createdAt',
  );
  @override
  late final GeneratedColumn<DateTime> createdAt = GeneratedColumn<DateTime>(
    'created_at',
    aliasedName,
    false,
    type: DriftSqlType.dateTime,
    requiredDuringInsert: false,
    defaultValue: currentDateAndTime,
  );
  @override
  List<GeneratedColumn> get $columns => [
    extractedId,
    captureId,
    domain,
    entitiesJson,
    confidence,
    committed,
    createdAt,
  ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'extracted_captures';
  @override
  VerificationContext validateIntegrity(
    Insertable<ExtractedCapture> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('extracted_id')) {
      context.handle(
        _extractedIdMeta,
        extractedId.isAcceptableOrUnknown(
          data['extracted_id']!,
          _extractedIdMeta,
        ),
      );
    } else if (isInserting) {
      context.missing(_extractedIdMeta);
    }
    if (data.containsKey('capture_id')) {
      context.handle(
        _captureIdMeta,
        captureId.isAcceptableOrUnknown(data['capture_id']!, _captureIdMeta),
      );
    } else if (isInserting) {
      context.missing(_captureIdMeta);
    }
    if (data.containsKey('domain')) {
      context.handle(
        _domainMeta,
        domain.isAcceptableOrUnknown(data['domain']!, _domainMeta),
      );
    } else if (isInserting) {
      context.missing(_domainMeta);
    }
    if (data.containsKey('entities_json')) {
      context.handle(
        _entitiesJsonMeta,
        entitiesJson.isAcceptableOrUnknown(
          data['entities_json']!,
          _entitiesJsonMeta,
        ),
      );
    }
    if (data.containsKey('confidence')) {
      context.handle(
        _confidenceMeta,
        confidence.isAcceptableOrUnknown(data['confidence']!, _confidenceMeta),
      );
    } else if (isInserting) {
      context.missing(_confidenceMeta);
    }
    if (data.containsKey('committed')) {
      context.handle(
        _committedMeta,
        committed.isAcceptableOrUnknown(data['committed']!, _committedMeta),
      );
    }
    if (data.containsKey('created_at')) {
      context.handle(
        _createdAtMeta,
        createdAt.isAcceptableOrUnknown(data['created_at']!, _createdAtMeta),
      );
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {extractedId};
  @override
  ExtractedCapture map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return ExtractedCapture(
      extractedId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}extracted_id'],
      )!,
      captureId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}capture_id'],
      )!,
      domain: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}domain'],
      )!,
      entitiesJson: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}entities_json'],
      ),
      confidence: attachedDatabase.typeMapping.read(
        DriftSqlType.double,
        data['${effectivePrefix}confidence'],
      )!,
      committed: attachedDatabase.typeMapping.read(
        DriftSqlType.bool,
        data['${effectivePrefix}committed'],
      )!,
      createdAt: attachedDatabase.typeMapping.read(
        DriftSqlType.dateTime,
        data['${effectivePrefix}created_at'],
      )!,
    );
  }

  @override
  $ExtractedCapturesTable createAlias(String alias) {
    return $ExtractedCapturesTable(attachedDatabase, alias);
  }
}

class ExtractedCapture extends DataClass
    implements Insertable<ExtractedCapture> {
  final String extractedId;
  final String captureId;
  final String domain;
  final String? entitiesJson;
  final double confidence;
  final bool committed;
  final DateTime createdAt;
  const ExtractedCapture({
    required this.extractedId,
    required this.captureId,
    required this.domain,
    this.entitiesJson,
    required this.confidence,
    required this.committed,
    required this.createdAt,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['extracted_id'] = Variable<String>(extractedId);
    map['capture_id'] = Variable<String>(captureId);
    map['domain'] = Variable<String>(domain);
    if (!nullToAbsent || entitiesJson != null) {
      map['entities_json'] = Variable<String>(entitiesJson);
    }
    map['confidence'] = Variable<double>(confidence);
    map['committed'] = Variable<bool>(committed);
    map['created_at'] = Variable<DateTime>(createdAt);
    return map;
  }

  ExtractedCapturesCompanion toCompanion(bool nullToAbsent) {
    return ExtractedCapturesCompanion(
      extractedId: Value(extractedId),
      captureId: Value(captureId),
      domain: Value(domain),
      entitiesJson: entitiesJson == null && nullToAbsent
          ? const Value.absent()
          : Value(entitiesJson),
      confidence: Value(confidence),
      committed: Value(committed),
      createdAt: Value(createdAt),
    );
  }

  factory ExtractedCapture.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return ExtractedCapture(
      extractedId: serializer.fromJson<String>(json['extractedId']),
      captureId: serializer.fromJson<String>(json['captureId']),
      domain: serializer.fromJson<String>(json['domain']),
      entitiesJson: serializer.fromJson<String?>(json['entitiesJson']),
      confidence: serializer.fromJson<double>(json['confidence']),
      committed: serializer.fromJson<bool>(json['committed']),
      createdAt: serializer.fromJson<DateTime>(json['createdAt']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'extractedId': serializer.toJson<String>(extractedId),
      'captureId': serializer.toJson<String>(captureId),
      'domain': serializer.toJson<String>(domain),
      'entitiesJson': serializer.toJson<String?>(entitiesJson),
      'confidence': serializer.toJson<double>(confidence),
      'committed': serializer.toJson<bool>(committed),
      'createdAt': serializer.toJson<DateTime>(createdAt),
    };
  }

  ExtractedCapture copyWith({
    String? extractedId,
    String? captureId,
    String? domain,
    Value<String?> entitiesJson = const Value.absent(),
    double? confidence,
    bool? committed,
    DateTime? createdAt,
  }) => ExtractedCapture(
    extractedId: extractedId ?? this.extractedId,
    captureId: captureId ?? this.captureId,
    domain: domain ?? this.domain,
    entitiesJson: entitiesJson.present ? entitiesJson.value : this.entitiesJson,
    confidence: confidence ?? this.confidence,
    committed: committed ?? this.committed,
    createdAt: createdAt ?? this.createdAt,
  );
  ExtractedCapture copyWithCompanion(ExtractedCapturesCompanion data) {
    return ExtractedCapture(
      extractedId: data.extractedId.present
          ? data.extractedId.value
          : this.extractedId,
      captureId: data.captureId.present ? data.captureId.value : this.captureId,
      domain: data.domain.present ? data.domain.value : this.domain,
      entitiesJson: data.entitiesJson.present
          ? data.entitiesJson.value
          : this.entitiesJson,
      confidence: data.confidence.present
          ? data.confidence.value
          : this.confidence,
      committed: data.committed.present ? data.committed.value : this.committed,
      createdAt: data.createdAt.present ? data.createdAt.value : this.createdAt,
    );
  }

  @override
  String toString() {
    return (StringBuffer('ExtractedCapture(')
          ..write('extractedId: $extractedId, ')
          ..write('captureId: $captureId, ')
          ..write('domain: $domain, ')
          ..write('entitiesJson: $entitiesJson, ')
          ..write('confidence: $confidence, ')
          ..write('committed: $committed, ')
          ..write('createdAt: $createdAt')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(
    extractedId,
    captureId,
    domain,
    entitiesJson,
    confidence,
    committed,
    createdAt,
  );
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is ExtractedCapture &&
          other.extractedId == this.extractedId &&
          other.captureId == this.captureId &&
          other.domain == this.domain &&
          other.entitiesJson == this.entitiesJson &&
          other.confidence == this.confidence &&
          other.committed == this.committed &&
          other.createdAt == this.createdAt);
}

class ExtractedCapturesCompanion extends UpdateCompanion<ExtractedCapture> {
  final Value<String> extractedId;
  final Value<String> captureId;
  final Value<String> domain;
  final Value<String?> entitiesJson;
  final Value<double> confidence;
  final Value<bool> committed;
  final Value<DateTime> createdAt;
  final Value<int> rowid;
  const ExtractedCapturesCompanion({
    this.extractedId = const Value.absent(),
    this.captureId = const Value.absent(),
    this.domain = const Value.absent(),
    this.entitiesJson = const Value.absent(),
    this.confidence = const Value.absent(),
    this.committed = const Value.absent(),
    this.createdAt = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  ExtractedCapturesCompanion.insert({
    required String extractedId,
    required String captureId,
    required String domain,
    this.entitiesJson = const Value.absent(),
    required double confidence,
    this.committed = const Value.absent(),
    this.createdAt = const Value.absent(),
    this.rowid = const Value.absent(),
  }) : extractedId = Value(extractedId),
       captureId = Value(captureId),
       domain = Value(domain),
       confidence = Value(confidence);
  static Insertable<ExtractedCapture> custom({
    Expression<String>? extractedId,
    Expression<String>? captureId,
    Expression<String>? domain,
    Expression<String>? entitiesJson,
    Expression<double>? confidence,
    Expression<bool>? committed,
    Expression<DateTime>? createdAt,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (extractedId != null) 'extracted_id': extractedId,
      if (captureId != null) 'capture_id': captureId,
      if (domain != null) 'domain': domain,
      if (entitiesJson != null) 'entities_json': entitiesJson,
      if (confidence != null) 'confidence': confidence,
      if (committed != null) 'committed': committed,
      if (createdAt != null) 'created_at': createdAt,
      if (rowid != null) 'rowid': rowid,
    });
  }

  ExtractedCapturesCompanion copyWith({
    Value<String>? extractedId,
    Value<String>? captureId,
    Value<String>? domain,
    Value<String?>? entitiesJson,
    Value<double>? confidence,
    Value<bool>? committed,
    Value<DateTime>? createdAt,
    Value<int>? rowid,
  }) {
    return ExtractedCapturesCompanion(
      extractedId: extractedId ?? this.extractedId,
      captureId: captureId ?? this.captureId,
      domain: domain ?? this.domain,
      entitiesJson: entitiesJson ?? this.entitiesJson,
      confidence: confidence ?? this.confidence,
      committed: committed ?? this.committed,
      createdAt: createdAt ?? this.createdAt,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (extractedId.present) {
      map['extracted_id'] = Variable<String>(extractedId.value);
    }
    if (captureId.present) {
      map['capture_id'] = Variable<String>(captureId.value);
    }
    if (domain.present) {
      map['domain'] = Variable<String>(domain.value);
    }
    if (entitiesJson.present) {
      map['entities_json'] = Variable<String>(entitiesJson.value);
    }
    if (confidence.present) {
      map['confidence'] = Variable<double>(confidence.value);
    }
    if (committed.present) {
      map['committed'] = Variable<bool>(committed.value);
    }
    if (createdAt.present) {
      map['created_at'] = Variable<DateTime>(createdAt.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('ExtractedCapturesCompanion(')
          ..write('extractedId: $extractedId, ')
          ..write('captureId: $captureId, ')
          ..write('domain: $domain, ')
          ..write('entitiesJson: $entitiesJson, ')
          ..write('confidence: $confidence, ')
          ..write('committed: $committed, ')
          ..write('createdAt: $createdAt, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $TransactionsTable extends Transactions
    with TableInfo<$TransactionsTable, Transaction> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $TransactionsTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _transactionIdMeta = const VerificationMeta(
    'transactionId',
  );
  @override
  late final GeneratedColumn<String> transactionId = GeneratedColumn<String>(
    'transaction_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _userIdMeta = const VerificationMeta('userId');
  @override
  late final GeneratedColumn<String> userId = GeneratedColumn<String>(
    'user_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _extractedIdMeta = const VerificationMeta(
    'extractedId',
  );
  @override
  late final GeneratedColumn<String> extractedId = GeneratedColumn<String>(
    'extracted_id',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _occurredAtMeta = const VerificationMeta(
    'occurredAt',
  );
  @override
  late final GeneratedColumn<DateTime> occurredAt = GeneratedColumn<DateTime>(
    'occurred_at',
    aliasedName,
    false,
    type: DriftSqlType.dateTime,
    requiredDuringInsert: false,
    defaultValue: currentDateAndTime,
  );
  static const VerificationMeta _directionMeta = const VerificationMeta(
    'direction',
  );
  @override
  late final GeneratedColumn<String> direction = GeneratedColumn<String>(
    'direction',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _amountMeta = const VerificationMeta('amount');
  @override
  late final GeneratedColumn<int> amount = GeneratedColumn<int>(
    'amount',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _categoryMeta = const VerificationMeta(
    'category',
  );
  @override
  late final GeneratedColumn<String> category = GeneratedColumn<String>(
    'category',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _memoMeta = const VerificationMeta('memo');
  @override
  late final GeneratedColumn<String> memo = GeneratedColumn<String>(
    'memo',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _sourceMeta = const VerificationMeta('source');
  @override
  late final GeneratedColumn<String> source = GeneratedColumn<String>(
    'source',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
    defaultValue: const Constant('manual'),
  );
  static const VerificationMeta _createdAtMeta = const VerificationMeta(
    'createdAt',
  );
  @override
  late final GeneratedColumn<DateTime> createdAt = GeneratedColumn<DateTime>(
    'created_at',
    aliasedName,
    false,
    type: DriftSqlType.dateTime,
    requiredDuringInsert: false,
    defaultValue: currentDateAndTime,
  );
  @override
  List<GeneratedColumn> get $columns => [
    transactionId,
    userId,
    extractedId,
    occurredAt,
    direction,
    amount,
    category,
    memo,
    source,
    createdAt,
  ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'transactions';
  @override
  VerificationContext validateIntegrity(
    Insertable<Transaction> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('transaction_id')) {
      context.handle(
        _transactionIdMeta,
        transactionId.isAcceptableOrUnknown(
          data['transaction_id']!,
          _transactionIdMeta,
        ),
      );
    } else if (isInserting) {
      context.missing(_transactionIdMeta);
    }
    if (data.containsKey('user_id')) {
      context.handle(
        _userIdMeta,
        userId.isAcceptableOrUnknown(data['user_id']!, _userIdMeta),
      );
    } else if (isInserting) {
      context.missing(_userIdMeta);
    }
    if (data.containsKey('extracted_id')) {
      context.handle(
        _extractedIdMeta,
        extractedId.isAcceptableOrUnknown(
          data['extracted_id']!,
          _extractedIdMeta,
        ),
      );
    }
    if (data.containsKey('occurred_at')) {
      context.handle(
        _occurredAtMeta,
        occurredAt.isAcceptableOrUnknown(data['occurred_at']!, _occurredAtMeta),
      );
    }
    if (data.containsKey('direction')) {
      context.handle(
        _directionMeta,
        direction.isAcceptableOrUnknown(data['direction']!, _directionMeta),
      );
    } else if (isInserting) {
      context.missing(_directionMeta);
    }
    if (data.containsKey('amount')) {
      context.handle(
        _amountMeta,
        amount.isAcceptableOrUnknown(data['amount']!, _amountMeta),
      );
    } else if (isInserting) {
      context.missing(_amountMeta);
    }
    if (data.containsKey('category')) {
      context.handle(
        _categoryMeta,
        category.isAcceptableOrUnknown(data['category']!, _categoryMeta),
      );
    }
    if (data.containsKey('memo')) {
      context.handle(
        _memoMeta,
        memo.isAcceptableOrUnknown(data['memo']!, _memoMeta),
      );
    }
    if (data.containsKey('source')) {
      context.handle(
        _sourceMeta,
        source.isAcceptableOrUnknown(data['source']!, _sourceMeta),
      );
    }
    if (data.containsKey('created_at')) {
      context.handle(
        _createdAtMeta,
        createdAt.isAcceptableOrUnknown(data['created_at']!, _createdAtMeta),
      );
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {transactionId};
  @override
  Transaction map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return Transaction(
      transactionId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}transaction_id'],
      )!,
      userId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}user_id'],
      )!,
      extractedId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}extracted_id'],
      ),
      occurredAt: attachedDatabase.typeMapping.read(
        DriftSqlType.dateTime,
        data['${effectivePrefix}occurred_at'],
      )!,
      direction: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}direction'],
      )!,
      amount: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}amount'],
      )!,
      category: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}category'],
      ),
      memo: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}memo'],
      ),
      source: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}source'],
      )!,
      createdAt: attachedDatabase.typeMapping.read(
        DriftSqlType.dateTime,
        data['${effectivePrefix}created_at'],
      )!,
    );
  }

  @override
  $TransactionsTable createAlias(String alias) {
    return $TransactionsTable(attachedDatabase, alias);
  }
}

class Transaction extends DataClass implements Insertable<Transaction> {
  final String transactionId;
  final String userId;
  final String? extractedId;
  final DateTime occurredAt;
  final String direction;
  final int amount;
  final String? category;
  final String? memo;
  final String source;
  final DateTime createdAt;
  const Transaction({
    required this.transactionId,
    required this.userId,
    this.extractedId,
    required this.occurredAt,
    required this.direction,
    required this.amount,
    this.category,
    this.memo,
    required this.source,
    required this.createdAt,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['transaction_id'] = Variable<String>(transactionId);
    map['user_id'] = Variable<String>(userId);
    if (!nullToAbsent || extractedId != null) {
      map['extracted_id'] = Variable<String>(extractedId);
    }
    map['occurred_at'] = Variable<DateTime>(occurredAt);
    map['direction'] = Variable<String>(direction);
    map['amount'] = Variable<int>(amount);
    if (!nullToAbsent || category != null) {
      map['category'] = Variable<String>(category);
    }
    if (!nullToAbsent || memo != null) {
      map['memo'] = Variable<String>(memo);
    }
    map['source'] = Variable<String>(source);
    map['created_at'] = Variable<DateTime>(createdAt);
    return map;
  }

  TransactionsCompanion toCompanion(bool nullToAbsent) {
    return TransactionsCompanion(
      transactionId: Value(transactionId),
      userId: Value(userId),
      extractedId: extractedId == null && nullToAbsent
          ? const Value.absent()
          : Value(extractedId),
      occurredAt: Value(occurredAt),
      direction: Value(direction),
      amount: Value(amount),
      category: category == null && nullToAbsent
          ? const Value.absent()
          : Value(category),
      memo: memo == null && nullToAbsent ? const Value.absent() : Value(memo),
      source: Value(source),
      createdAt: Value(createdAt),
    );
  }

  factory Transaction.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return Transaction(
      transactionId: serializer.fromJson<String>(json['transactionId']),
      userId: serializer.fromJson<String>(json['userId']),
      extractedId: serializer.fromJson<String?>(json['extractedId']),
      occurredAt: serializer.fromJson<DateTime>(json['occurredAt']),
      direction: serializer.fromJson<String>(json['direction']),
      amount: serializer.fromJson<int>(json['amount']),
      category: serializer.fromJson<String?>(json['category']),
      memo: serializer.fromJson<String?>(json['memo']),
      source: serializer.fromJson<String>(json['source']),
      createdAt: serializer.fromJson<DateTime>(json['createdAt']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'transactionId': serializer.toJson<String>(transactionId),
      'userId': serializer.toJson<String>(userId),
      'extractedId': serializer.toJson<String?>(extractedId),
      'occurredAt': serializer.toJson<DateTime>(occurredAt),
      'direction': serializer.toJson<String>(direction),
      'amount': serializer.toJson<int>(amount),
      'category': serializer.toJson<String?>(category),
      'memo': serializer.toJson<String?>(memo),
      'source': serializer.toJson<String>(source),
      'createdAt': serializer.toJson<DateTime>(createdAt),
    };
  }

  Transaction copyWith({
    String? transactionId,
    String? userId,
    Value<String?> extractedId = const Value.absent(),
    DateTime? occurredAt,
    String? direction,
    int? amount,
    Value<String?> category = const Value.absent(),
    Value<String?> memo = const Value.absent(),
    String? source,
    DateTime? createdAt,
  }) => Transaction(
    transactionId: transactionId ?? this.transactionId,
    userId: userId ?? this.userId,
    extractedId: extractedId.present ? extractedId.value : this.extractedId,
    occurredAt: occurredAt ?? this.occurredAt,
    direction: direction ?? this.direction,
    amount: amount ?? this.amount,
    category: category.present ? category.value : this.category,
    memo: memo.present ? memo.value : this.memo,
    source: source ?? this.source,
    createdAt: createdAt ?? this.createdAt,
  );
  Transaction copyWithCompanion(TransactionsCompanion data) {
    return Transaction(
      transactionId: data.transactionId.present
          ? data.transactionId.value
          : this.transactionId,
      userId: data.userId.present ? data.userId.value : this.userId,
      extractedId: data.extractedId.present
          ? data.extractedId.value
          : this.extractedId,
      occurredAt: data.occurredAt.present
          ? data.occurredAt.value
          : this.occurredAt,
      direction: data.direction.present ? data.direction.value : this.direction,
      amount: data.amount.present ? data.amount.value : this.amount,
      category: data.category.present ? data.category.value : this.category,
      memo: data.memo.present ? data.memo.value : this.memo,
      source: data.source.present ? data.source.value : this.source,
      createdAt: data.createdAt.present ? data.createdAt.value : this.createdAt,
    );
  }

  @override
  String toString() {
    return (StringBuffer('Transaction(')
          ..write('transactionId: $transactionId, ')
          ..write('userId: $userId, ')
          ..write('extractedId: $extractedId, ')
          ..write('occurredAt: $occurredAt, ')
          ..write('direction: $direction, ')
          ..write('amount: $amount, ')
          ..write('category: $category, ')
          ..write('memo: $memo, ')
          ..write('source: $source, ')
          ..write('createdAt: $createdAt')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(
    transactionId,
    userId,
    extractedId,
    occurredAt,
    direction,
    amount,
    category,
    memo,
    source,
    createdAt,
  );
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is Transaction &&
          other.transactionId == this.transactionId &&
          other.userId == this.userId &&
          other.extractedId == this.extractedId &&
          other.occurredAt == this.occurredAt &&
          other.direction == this.direction &&
          other.amount == this.amount &&
          other.category == this.category &&
          other.memo == this.memo &&
          other.source == this.source &&
          other.createdAt == this.createdAt);
}

class TransactionsCompanion extends UpdateCompanion<Transaction> {
  final Value<String> transactionId;
  final Value<String> userId;
  final Value<String?> extractedId;
  final Value<DateTime> occurredAt;
  final Value<String> direction;
  final Value<int> amount;
  final Value<String?> category;
  final Value<String?> memo;
  final Value<String> source;
  final Value<DateTime> createdAt;
  final Value<int> rowid;
  const TransactionsCompanion({
    this.transactionId = const Value.absent(),
    this.userId = const Value.absent(),
    this.extractedId = const Value.absent(),
    this.occurredAt = const Value.absent(),
    this.direction = const Value.absent(),
    this.amount = const Value.absent(),
    this.category = const Value.absent(),
    this.memo = const Value.absent(),
    this.source = const Value.absent(),
    this.createdAt = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  TransactionsCompanion.insert({
    required String transactionId,
    required String userId,
    this.extractedId = const Value.absent(),
    this.occurredAt = const Value.absent(),
    required String direction,
    required int amount,
    this.category = const Value.absent(),
    this.memo = const Value.absent(),
    this.source = const Value.absent(),
    this.createdAt = const Value.absent(),
    this.rowid = const Value.absent(),
  }) : transactionId = Value(transactionId),
       userId = Value(userId),
       direction = Value(direction),
       amount = Value(amount);
  static Insertable<Transaction> custom({
    Expression<String>? transactionId,
    Expression<String>? userId,
    Expression<String>? extractedId,
    Expression<DateTime>? occurredAt,
    Expression<String>? direction,
    Expression<int>? amount,
    Expression<String>? category,
    Expression<String>? memo,
    Expression<String>? source,
    Expression<DateTime>? createdAt,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (transactionId != null) 'transaction_id': transactionId,
      if (userId != null) 'user_id': userId,
      if (extractedId != null) 'extracted_id': extractedId,
      if (occurredAt != null) 'occurred_at': occurredAt,
      if (direction != null) 'direction': direction,
      if (amount != null) 'amount': amount,
      if (category != null) 'category': category,
      if (memo != null) 'memo': memo,
      if (source != null) 'source': source,
      if (createdAt != null) 'created_at': createdAt,
      if (rowid != null) 'rowid': rowid,
    });
  }

  TransactionsCompanion copyWith({
    Value<String>? transactionId,
    Value<String>? userId,
    Value<String?>? extractedId,
    Value<DateTime>? occurredAt,
    Value<String>? direction,
    Value<int>? amount,
    Value<String?>? category,
    Value<String?>? memo,
    Value<String>? source,
    Value<DateTime>? createdAt,
    Value<int>? rowid,
  }) {
    return TransactionsCompanion(
      transactionId: transactionId ?? this.transactionId,
      userId: userId ?? this.userId,
      extractedId: extractedId ?? this.extractedId,
      occurredAt: occurredAt ?? this.occurredAt,
      direction: direction ?? this.direction,
      amount: amount ?? this.amount,
      category: category ?? this.category,
      memo: memo ?? this.memo,
      source: source ?? this.source,
      createdAt: createdAt ?? this.createdAt,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (transactionId.present) {
      map['transaction_id'] = Variable<String>(transactionId.value);
    }
    if (userId.present) {
      map['user_id'] = Variable<String>(userId.value);
    }
    if (extractedId.present) {
      map['extracted_id'] = Variable<String>(extractedId.value);
    }
    if (occurredAt.present) {
      map['occurred_at'] = Variable<DateTime>(occurredAt.value);
    }
    if (direction.present) {
      map['direction'] = Variable<String>(direction.value);
    }
    if (amount.present) {
      map['amount'] = Variable<int>(amount.value);
    }
    if (category.present) {
      map['category'] = Variable<String>(category.value);
    }
    if (memo.present) {
      map['memo'] = Variable<String>(memo.value);
    }
    if (source.present) {
      map['source'] = Variable<String>(source.value);
    }
    if (createdAt.present) {
      map['created_at'] = Variable<DateTime>(createdAt.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('TransactionsCompanion(')
          ..write('transactionId: $transactionId, ')
          ..write('userId: $userId, ')
          ..write('extractedId: $extractedId, ')
          ..write('occurredAt: $occurredAt, ')
          ..write('direction: $direction, ')
          ..write('amount: $amount, ')
          ..write('category: $category, ')
          ..write('memo: $memo, ')
          ..write('source: $source, ')
          ..write('createdAt: $createdAt, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $MemosTable extends Memos with TableInfo<$MemosTable, Memo> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $MemosTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _memoIdMeta = const VerificationMeta('memoId');
  @override
  late final GeneratedColumn<String> memoId = GeneratedColumn<String>(
    'memo_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _userIdMeta = const VerificationMeta('userId');
  @override
  late final GeneratedColumn<String> userId = GeneratedColumn<String>(
    'user_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _contentMeta = const VerificationMeta(
    'content',
  );
  @override
  late final GeneratedColumn<String> content = GeneratedColumn<String>(
    'content',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _tagsMeta = const VerificationMeta('tags');
  @override
  late final GeneratedColumn<String> tags = GeneratedColumn<String>(
    'tags',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _sourceMeta = const VerificationMeta('source');
  @override
  late final GeneratedColumn<String> source = GeneratedColumn<String>(
    'source',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
    defaultValue: const Constant('manual'),
  );
  static const VerificationMeta _extractedIdMeta = const VerificationMeta(
    'extractedId',
  );
  @override
  late final GeneratedColumn<String> extractedId = GeneratedColumn<String>(
    'extracted_id',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _createdAtMeta = const VerificationMeta(
    'createdAt',
  );
  @override
  late final GeneratedColumn<DateTime> createdAt = GeneratedColumn<DateTime>(
    'created_at',
    aliasedName,
    false,
    type: DriftSqlType.dateTime,
    requiredDuringInsert: false,
    defaultValue: currentDateAndTime,
  );
  static const VerificationMeta _updatedAtMeta = const VerificationMeta(
    'updatedAt',
  );
  @override
  late final GeneratedColumn<DateTime> updatedAt = GeneratedColumn<DateTime>(
    'updated_at',
    aliasedName,
    false,
    type: DriftSqlType.dateTime,
    requiredDuringInsert: false,
    defaultValue: currentDateAndTime,
  );
  @override
  List<GeneratedColumn> get $columns => [
    memoId,
    userId,
    content,
    tags,
    source,
    extractedId,
    createdAt,
    updatedAt,
  ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'memos';
  @override
  VerificationContext validateIntegrity(
    Insertable<Memo> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('memo_id')) {
      context.handle(
        _memoIdMeta,
        memoId.isAcceptableOrUnknown(data['memo_id']!, _memoIdMeta),
      );
    } else if (isInserting) {
      context.missing(_memoIdMeta);
    }
    if (data.containsKey('user_id')) {
      context.handle(
        _userIdMeta,
        userId.isAcceptableOrUnknown(data['user_id']!, _userIdMeta),
      );
    } else if (isInserting) {
      context.missing(_userIdMeta);
    }
    if (data.containsKey('content')) {
      context.handle(
        _contentMeta,
        content.isAcceptableOrUnknown(data['content']!, _contentMeta),
      );
    } else if (isInserting) {
      context.missing(_contentMeta);
    }
    if (data.containsKey('tags')) {
      context.handle(
        _tagsMeta,
        tags.isAcceptableOrUnknown(data['tags']!, _tagsMeta),
      );
    }
    if (data.containsKey('source')) {
      context.handle(
        _sourceMeta,
        source.isAcceptableOrUnknown(data['source']!, _sourceMeta),
      );
    }
    if (data.containsKey('extracted_id')) {
      context.handle(
        _extractedIdMeta,
        extractedId.isAcceptableOrUnknown(
          data['extracted_id']!,
          _extractedIdMeta,
        ),
      );
    }
    if (data.containsKey('created_at')) {
      context.handle(
        _createdAtMeta,
        createdAt.isAcceptableOrUnknown(data['created_at']!, _createdAtMeta),
      );
    }
    if (data.containsKey('updated_at')) {
      context.handle(
        _updatedAtMeta,
        updatedAt.isAcceptableOrUnknown(data['updated_at']!, _updatedAtMeta),
      );
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {memoId};
  @override
  Memo map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return Memo(
      memoId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}memo_id'],
      )!,
      userId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}user_id'],
      )!,
      content: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}content'],
      )!,
      tags: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}tags'],
      ),
      source: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}source'],
      )!,
      extractedId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}extracted_id'],
      ),
      createdAt: attachedDatabase.typeMapping.read(
        DriftSqlType.dateTime,
        data['${effectivePrefix}created_at'],
      )!,
      updatedAt: attachedDatabase.typeMapping.read(
        DriftSqlType.dateTime,
        data['${effectivePrefix}updated_at'],
      )!,
    );
  }

  @override
  $MemosTable createAlias(String alias) {
    return $MemosTable(attachedDatabase, alias);
  }
}

class Memo extends DataClass implements Insertable<Memo> {
  final String memoId;
  final String userId;
  final String content;
  final String? tags;
  final String source;
  final String? extractedId;
  final DateTime createdAt;
  final DateTime updatedAt;
  const Memo({
    required this.memoId,
    required this.userId,
    required this.content,
    this.tags,
    required this.source,
    this.extractedId,
    required this.createdAt,
    required this.updatedAt,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['memo_id'] = Variable<String>(memoId);
    map['user_id'] = Variable<String>(userId);
    map['content'] = Variable<String>(content);
    if (!nullToAbsent || tags != null) {
      map['tags'] = Variable<String>(tags);
    }
    map['source'] = Variable<String>(source);
    if (!nullToAbsent || extractedId != null) {
      map['extracted_id'] = Variable<String>(extractedId);
    }
    map['created_at'] = Variable<DateTime>(createdAt);
    map['updated_at'] = Variable<DateTime>(updatedAt);
    return map;
  }

  MemosCompanion toCompanion(bool nullToAbsent) {
    return MemosCompanion(
      memoId: Value(memoId),
      userId: Value(userId),
      content: Value(content),
      tags: tags == null && nullToAbsent ? const Value.absent() : Value(tags),
      source: Value(source),
      extractedId: extractedId == null && nullToAbsent
          ? const Value.absent()
          : Value(extractedId),
      createdAt: Value(createdAt),
      updatedAt: Value(updatedAt),
    );
  }

  factory Memo.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return Memo(
      memoId: serializer.fromJson<String>(json['memoId']),
      userId: serializer.fromJson<String>(json['userId']),
      content: serializer.fromJson<String>(json['content']),
      tags: serializer.fromJson<String?>(json['tags']),
      source: serializer.fromJson<String>(json['source']),
      extractedId: serializer.fromJson<String?>(json['extractedId']),
      createdAt: serializer.fromJson<DateTime>(json['createdAt']),
      updatedAt: serializer.fromJson<DateTime>(json['updatedAt']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'memoId': serializer.toJson<String>(memoId),
      'userId': serializer.toJson<String>(userId),
      'content': serializer.toJson<String>(content),
      'tags': serializer.toJson<String?>(tags),
      'source': serializer.toJson<String>(source),
      'extractedId': serializer.toJson<String?>(extractedId),
      'createdAt': serializer.toJson<DateTime>(createdAt),
      'updatedAt': serializer.toJson<DateTime>(updatedAt),
    };
  }

  Memo copyWith({
    String? memoId,
    String? userId,
    String? content,
    Value<String?> tags = const Value.absent(),
    String? source,
    Value<String?> extractedId = const Value.absent(),
    DateTime? createdAt,
    DateTime? updatedAt,
  }) => Memo(
    memoId: memoId ?? this.memoId,
    userId: userId ?? this.userId,
    content: content ?? this.content,
    tags: tags.present ? tags.value : this.tags,
    source: source ?? this.source,
    extractedId: extractedId.present ? extractedId.value : this.extractedId,
    createdAt: createdAt ?? this.createdAt,
    updatedAt: updatedAt ?? this.updatedAt,
  );
  Memo copyWithCompanion(MemosCompanion data) {
    return Memo(
      memoId: data.memoId.present ? data.memoId.value : this.memoId,
      userId: data.userId.present ? data.userId.value : this.userId,
      content: data.content.present ? data.content.value : this.content,
      tags: data.tags.present ? data.tags.value : this.tags,
      source: data.source.present ? data.source.value : this.source,
      extractedId: data.extractedId.present
          ? data.extractedId.value
          : this.extractedId,
      createdAt: data.createdAt.present ? data.createdAt.value : this.createdAt,
      updatedAt: data.updatedAt.present ? data.updatedAt.value : this.updatedAt,
    );
  }

  @override
  String toString() {
    return (StringBuffer('Memo(')
          ..write('memoId: $memoId, ')
          ..write('userId: $userId, ')
          ..write('content: $content, ')
          ..write('tags: $tags, ')
          ..write('source: $source, ')
          ..write('extractedId: $extractedId, ')
          ..write('createdAt: $createdAt, ')
          ..write('updatedAt: $updatedAt')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(
    memoId,
    userId,
    content,
    tags,
    source,
    extractedId,
    createdAt,
    updatedAt,
  );
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is Memo &&
          other.memoId == this.memoId &&
          other.userId == this.userId &&
          other.content == this.content &&
          other.tags == this.tags &&
          other.source == this.source &&
          other.extractedId == this.extractedId &&
          other.createdAt == this.createdAt &&
          other.updatedAt == this.updatedAt);
}

class MemosCompanion extends UpdateCompanion<Memo> {
  final Value<String> memoId;
  final Value<String> userId;
  final Value<String> content;
  final Value<String?> tags;
  final Value<String> source;
  final Value<String?> extractedId;
  final Value<DateTime> createdAt;
  final Value<DateTime> updatedAt;
  final Value<int> rowid;
  const MemosCompanion({
    this.memoId = const Value.absent(),
    this.userId = const Value.absent(),
    this.content = const Value.absent(),
    this.tags = const Value.absent(),
    this.source = const Value.absent(),
    this.extractedId = const Value.absent(),
    this.createdAt = const Value.absent(),
    this.updatedAt = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  MemosCompanion.insert({
    required String memoId,
    required String userId,
    required String content,
    this.tags = const Value.absent(),
    this.source = const Value.absent(),
    this.extractedId = const Value.absent(),
    this.createdAt = const Value.absent(),
    this.updatedAt = const Value.absent(),
    this.rowid = const Value.absent(),
  }) : memoId = Value(memoId),
       userId = Value(userId),
       content = Value(content);
  static Insertable<Memo> custom({
    Expression<String>? memoId,
    Expression<String>? userId,
    Expression<String>? content,
    Expression<String>? tags,
    Expression<String>? source,
    Expression<String>? extractedId,
    Expression<DateTime>? createdAt,
    Expression<DateTime>? updatedAt,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (memoId != null) 'memo_id': memoId,
      if (userId != null) 'user_id': userId,
      if (content != null) 'content': content,
      if (tags != null) 'tags': tags,
      if (source != null) 'source': source,
      if (extractedId != null) 'extracted_id': extractedId,
      if (createdAt != null) 'created_at': createdAt,
      if (updatedAt != null) 'updated_at': updatedAt,
      if (rowid != null) 'rowid': rowid,
    });
  }

  MemosCompanion copyWith({
    Value<String>? memoId,
    Value<String>? userId,
    Value<String>? content,
    Value<String?>? tags,
    Value<String>? source,
    Value<String?>? extractedId,
    Value<DateTime>? createdAt,
    Value<DateTime>? updatedAt,
    Value<int>? rowid,
  }) {
    return MemosCompanion(
      memoId: memoId ?? this.memoId,
      userId: userId ?? this.userId,
      content: content ?? this.content,
      tags: tags ?? this.tags,
      source: source ?? this.source,
      extractedId: extractedId ?? this.extractedId,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (memoId.present) {
      map['memo_id'] = Variable<String>(memoId.value);
    }
    if (userId.present) {
      map['user_id'] = Variable<String>(userId.value);
    }
    if (content.present) {
      map['content'] = Variable<String>(content.value);
    }
    if (tags.present) {
      map['tags'] = Variable<String>(tags.value);
    }
    if (source.present) {
      map['source'] = Variable<String>(source.value);
    }
    if (extractedId.present) {
      map['extracted_id'] = Variable<String>(extractedId.value);
    }
    if (createdAt.present) {
      map['created_at'] = Variable<DateTime>(createdAt.value);
    }
    if (updatedAt.present) {
      map['updated_at'] = Variable<DateTime>(updatedAt.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('MemosCompanion(')
          ..write('memoId: $memoId, ')
          ..write('userId: $userId, ')
          ..write('content: $content, ')
          ..write('tags: $tags, ')
          ..write('source: $source, ')
          ..write('extractedId: $extractedId, ')
          ..write('createdAt: $createdAt, ')
          ..write('updatedAt: $updatedAt, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $BriefingsTable extends Briefings
    with TableInfo<$BriefingsTable, Briefing> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $BriefingsTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _briefingIdMeta = const VerificationMeta(
    'briefingId',
  );
  @override
  late final GeneratedColumn<String> briefingId = GeneratedColumn<String>(
    'briefing_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _userIdMeta = const VerificationMeta('userId');
  @override
  late final GeneratedColumn<String> userId = GeneratedColumn<String>(
    'user_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _dateKeyMeta = const VerificationMeta(
    'dateKey',
  );
  @override
  late final GeneratedColumn<String> dateKey = GeneratedColumn<String>(
    'date_key',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _mustDoJsonMeta = const VerificationMeta(
    'mustDoJson',
  );
  @override
  late final GeneratedColumn<String> mustDoJson = GeneratedColumn<String>(
    'must_do_json',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
    defaultValue: const Constant('[]'),
  );
  static const VerificationMeta _tasksJsonMeta = const VerificationMeta(
    'tasksJson',
  );
  @override
  late final GeneratedColumn<String> tasksJson = GeneratedColumn<String>(
    'tasks_json',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
    defaultValue: const Constant('[]'),
  );
  static const VerificationMeta _adviceMeta = const VerificationMeta('advice');
  @override
  late final GeneratedColumn<String> advice = GeneratedColumn<String>(
    'advice',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _adviceBasisMeta = const VerificationMeta(
    'adviceBasis',
  );
  @override
  late final GeneratedColumn<String> adviceBasis = GeneratedColumn<String>(
    'advice_basis',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _createdAtMeta = const VerificationMeta(
    'createdAt',
  );
  @override
  late final GeneratedColumn<DateTime> createdAt = GeneratedColumn<DateTime>(
    'created_at',
    aliasedName,
    false,
    type: DriftSqlType.dateTime,
    requiredDuringInsert: false,
    defaultValue: currentDateAndTime,
  );
  @override
  List<GeneratedColumn> get $columns => [
    briefingId,
    userId,
    dateKey,
    mustDoJson,
    tasksJson,
    advice,
    adviceBasis,
    createdAt,
  ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'briefings';
  @override
  VerificationContext validateIntegrity(
    Insertable<Briefing> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('briefing_id')) {
      context.handle(
        _briefingIdMeta,
        briefingId.isAcceptableOrUnknown(data['briefing_id']!, _briefingIdMeta),
      );
    } else if (isInserting) {
      context.missing(_briefingIdMeta);
    }
    if (data.containsKey('user_id')) {
      context.handle(
        _userIdMeta,
        userId.isAcceptableOrUnknown(data['user_id']!, _userIdMeta),
      );
    } else if (isInserting) {
      context.missing(_userIdMeta);
    }
    if (data.containsKey('date_key')) {
      context.handle(
        _dateKeyMeta,
        dateKey.isAcceptableOrUnknown(data['date_key']!, _dateKeyMeta),
      );
    } else if (isInserting) {
      context.missing(_dateKeyMeta);
    }
    if (data.containsKey('must_do_json')) {
      context.handle(
        _mustDoJsonMeta,
        mustDoJson.isAcceptableOrUnknown(
          data['must_do_json']!,
          _mustDoJsonMeta,
        ),
      );
    }
    if (data.containsKey('tasks_json')) {
      context.handle(
        _tasksJsonMeta,
        tasksJson.isAcceptableOrUnknown(data['tasks_json']!, _tasksJsonMeta),
      );
    }
    if (data.containsKey('advice')) {
      context.handle(
        _adviceMeta,
        advice.isAcceptableOrUnknown(data['advice']!, _adviceMeta),
      );
    }
    if (data.containsKey('advice_basis')) {
      context.handle(
        _adviceBasisMeta,
        adviceBasis.isAcceptableOrUnknown(
          data['advice_basis']!,
          _adviceBasisMeta,
        ),
      );
    }
    if (data.containsKey('created_at')) {
      context.handle(
        _createdAtMeta,
        createdAt.isAcceptableOrUnknown(data['created_at']!, _createdAtMeta),
      );
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {briefingId};
  @override
  Briefing map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return Briefing(
      briefingId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}briefing_id'],
      )!,
      userId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}user_id'],
      )!,
      dateKey: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}date_key'],
      )!,
      mustDoJson: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}must_do_json'],
      )!,
      tasksJson: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}tasks_json'],
      )!,
      advice: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}advice'],
      ),
      adviceBasis: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}advice_basis'],
      ),
      createdAt: attachedDatabase.typeMapping.read(
        DriftSqlType.dateTime,
        data['${effectivePrefix}created_at'],
      )!,
    );
  }

  @override
  $BriefingsTable createAlias(String alias) {
    return $BriefingsTable(attachedDatabase, alias);
  }
}

class Briefing extends DataClass implements Insertable<Briefing> {
  final String briefingId;
  final String userId;
  final String dateKey;
  final String mustDoJson;
  final String tasksJson;
  final String? advice;
  final String? adviceBasis;
  final DateTime createdAt;
  const Briefing({
    required this.briefingId,
    required this.userId,
    required this.dateKey,
    required this.mustDoJson,
    required this.tasksJson,
    this.advice,
    this.adviceBasis,
    required this.createdAt,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['briefing_id'] = Variable<String>(briefingId);
    map['user_id'] = Variable<String>(userId);
    map['date_key'] = Variable<String>(dateKey);
    map['must_do_json'] = Variable<String>(mustDoJson);
    map['tasks_json'] = Variable<String>(tasksJson);
    if (!nullToAbsent || advice != null) {
      map['advice'] = Variable<String>(advice);
    }
    if (!nullToAbsent || adviceBasis != null) {
      map['advice_basis'] = Variable<String>(adviceBasis);
    }
    map['created_at'] = Variable<DateTime>(createdAt);
    return map;
  }

  BriefingsCompanion toCompanion(bool nullToAbsent) {
    return BriefingsCompanion(
      briefingId: Value(briefingId),
      userId: Value(userId),
      dateKey: Value(dateKey),
      mustDoJson: Value(mustDoJson),
      tasksJson: Value(tasksJson),
      advice: advice == null && nullToAbsent
          ? const Value.absent()
          : Value(advice),
      adviceBasis: adviceBasis == null && nullToAbsent
          ? const Value.absent()
          : Value(adviceBasis),
      createdAt: Value(createdAt),
    );
  }

  factory Briefing.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return Briefing(
      briefingId: serializer.fromJson<String>(json['briefingId']),
      userId: serializer.fromJson<String>(json['userId']),
      dateKey: serializer.fromJson<String>(json['dateKey']),
      mustDoJson: serializer.fromJson<String>(json['mustDoJson']),
      tasksJson: serializer.fromJson<String>(json['tasksJson']),
      advice: serializer.fromJson<String?>(json['advice']),
      adviceBasis: serializer.fromJson<String?>(json['adviceBasis']),
      createdAt: serializer.fromJson<DateTime>(json['createdAt']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'briefingId': serializer.toJson<String>(briefingId),
      'userId': serializer.toJson<String>(userId),
      'dateKey': serializer.toJson<String>(dateKey),
      'mustDoJson': serializer.toJson<String>(mustDoJson),
      'tasksJson': serializer.toJson<String>(tasksJson),
      'advice': serializer.toJson<String?>(advice),
      'adviceBasis': serializer.toJson<String?>(adviceBasis),
      'createdAt': serializer.toJson<DateTime>(createdAt),
    };
  }

  Briefing copyWith({
    String? briefingId,
    String? userId,
    String? dateKey,
    String? mustDoJson,
    String? tasksJson,
    Value<String?> advice = const Value.absent(),
    Value<String?> adviceBasis = const Value.absent(),
    DateTime? createdAt,
  }) => Briefing(
    briefingId: briefingId ?? this.briefingId,
    userId: userId ?? this.userId,
    dateKey: dateKey ?? this.dateKey,
    mustDoJson: mustDoJson ?? this.mustDoJson,
    tasksJson: tasksJson ?? this.tasksJson,
    advice: advice.present ? advice.value : this.advice,
    adviceBasis: adviceBasis.present ? adviceBasis.value : this.adviceBasis,
    createdAt: createdAt ?? this.createdAt,
  );
  Briefing copyWithCompanion(BriefingsCompanion data) {
    return Briefing(
      briefingId: data.briefingId.present
          ? data.briefingId.value
          : this.briefingId,
      userId: data.userId.present ? data.userId.value : this.userId,
      dateKey: data.dateKey.present ? data.dateKey.value : this.dateKey,
      mustDoJson: data.mustDoJson.present
          ? data.mustDoJson.value
          : this.mustDoJson,
      tasksJson: data.tasksJson.present ? data.tasksJson.value : this.tasksJson,
      advice: data.advice.present ? data.advice.value : this.advice,
      adviceBasis: data.adviceBasis.present
          ? data.adviceBasis.value
          : this.adviceBasis,
      createdAt: data.createdAt.present ? data.createdAt.value : this.createdAt,
    );
  }

  @override
  String toString() {
    return (StringBuffer('Briefing(')
          ..write('briefingId: $briefingId, ')
          ..write('userId: $userId, ')
          ..write('dateKey: $dateKey, ')
          ..write('mustDoJson: $mustDoJson, ')
          ..write('tasksJson: $tasksJson, ')
          ..write('advice: $advice, ')
          ..write('adviceBasis: $adviceBasis, ')
          ..write('createdAt: $createdAt')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(
    briefingId,
    userId,
    dateKey,
    mustDoJson,
    tasksJson,
    advice,
    adviceBasis,
    createdAt,
  );
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is Briefing &&
          other.briefingId == this.briefingId &&
          other.userId == this.userId &&
          other.dateKey == this.dateKey &&
          other.mustDoJson == this.mustDoJson &&
          other.tasksJson == this.tasksJson &&
          other.advice == this.advice &&
          other.adviceBasis == this.adviceBasis &&
          other.createdAt == this.createdAt);
}

class BriefingsCompanion extends UpdateCompanion<Briefing> {
  final Value<String> briefingId;
  final Value<String> userId;
  final Value<String> dateKey;
  final Value<String> mustDoJson;
  final Value<String> tasksJson;
  final Value<String?> advice;
  final Value<String?> adviceBasis;
  final Value<DateTime> createdAt;
  final Value<int> rowid;
  const BriefingsCompanion({
    this.briefingId = const Value.absent(),
    this.userId = const Value.absent(),
    this.dateKey = const Value.absent(),
    this.mustDoJson = const Value.absent(),
    this.tasksJson = const Value.absent(),
    this.advice = const Value.absent(),
    this.adviceBasis = const Value.absent(),
    this.createdAt = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  BriefingsCompanion.insert({
    required String briefingId,
    required String userId,
    required String dateKey,
    this.mustDoJson = const Value.absent(),
    this.tasksJson = const Value.absent(),
    this.advice = const Value.absent(),
    this.adviceBasis = const Value.absent(),
    this.createdAt = const Value.absent(),
    this.rowid = const Value.absent(),
  }) : briefingId = Value(briefingId),
       userId = Value(userId),
       dateKey = Value(dateKey);
  static Insertable<Briefing> custom({
    Expression<String>? briefingId,
    Expression<String>? userId,
    Expression<String>? dateKey,
    Expression<String>? mustDoJson,
    Expression<String>? tasksJson,
    Expression<String>? advice,
    Expression<String>? adviceBasis,
    Expression<DateTime>? createdAt,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (briefingId != null) 'briefing_id': briefingId,
      if (userId != null) 'user_id': userId,
      if (dateKey != null) 'date_key': dateKey,
      if (mustDoJson != null) 'must_do_json': mustDoJson,
      if (tasksJson != null) 'tasks_json': tasksJson,
      if (advice != null) 'advice': advice,
      if (adviceBasis != null) 'advice_basis': adviceBasis,
      if (createdAt != null) 'created_at': createdAt,
      if (rowid != null) 'rowid': rowid,
    });
  }

  BriefingsCompanion copyWith({
    Value<String>? briefingId,
    Value<String>? userId,
    Value<String>? dateKey,
    Value<String>? mustDoJson,
    Value<String>? tasksJson,
    Value<String?>? advice,
    Value<String?>? adviceBasis,
    Value<DateTime>? createdAt,
    Value<int>? rowid,
  }) {
    return BriefingsCompanion(
      briefingId: briefingId ?? this.briefingId,
      userId: userId ?? this.userId,
      dateKey: dateKey ?? this.dateKey,
      mustDoJson: mustDoJson ?? this.mustDoJson,
      tasksJson: tasksJson ?? this.tasksJson,
      advice: advice ?? this.advice,
      adviceBasis: adviceBasis ?? this.adviceBasis,
      createdAt: createdAt ?? this.createdAt,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (briefingId.present) {
      map['briefing_id'] = Variable<String>(briefingId.value);
    }
    if (userId.present) {
      map['user_id'] = Variable<String>(userId.value);
    }
    if (dateKey.present) {
      map['date_key'] = Variable<String>(dateKey.value);
    }
    if (mustDoJson.present) {
      map['must_do_json'] = Variable<String>(mustDoJson.value);
    }
    if (tasksJson.present) {
      map['tasks_json'] = Variable<String>(tasksJson.value);
    }
    if (advice.present) {
      map['advice'] = Variable<String>(advice.value);
    }
    if (adviceBasis.present) {
      map['advice_basis'] = Variable<String>(adviceBasis.value);
    }
    if (createdAt.present) {
      map['created_at'] = Variable<DateTime>(createdAt.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('BriefingsCompanion(')
          ..write('briefingId: $briefingId, ')
          ..write('userId: $userId, ')
          ..write('dateKey: $dateKey, ')
          ..write('mustDoJson: $mustDoJson, ')
          ..write('tasksJson: $tasksJson, ')
          ..write('advice: $advice, ')
          ..write('adviceBasis: $adviceBasis, ')
          ..write('createdAt: $createdAt, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $RollingSummariesTable extends RollingSummaries
    with TableInfo<$RollingSummariesTable, RollingSummary> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $RollingSummariesTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _summaryIdMeta = const VerificationMeta(
    'summaryId',
  );
  @override
  late final GeneratedColumn<String> summaryId = GeneratedColumn<String>(
    'summary_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _userIdMeta = const VerificationMeta('userId');
  @override
  late final GeneratedColumn<String> userId = GeneratedColumn<String>(
    'user_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _sleepSummaryMeta = const VerificationMeta(
    'sleepSummary',
  );
  @override
  late final GeneratedColumn<String> sleepSummary = GeneratedColumn<String>(
    'sleep_summary',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _expenseSummaryMeta = const VerificationMeta(
    'expenseSummary',
  );
  @override
  late final GeneratedColumn<String> expenseSummary = GeneratedColumn<String>(
    'expense_summary',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _lifeSummaryMeta = const VerificationMeta(
    'lifeSummary',
  );
  @override
  late final GeneratedColumn<String> lifeSummary = GeneratedColumn<String>(
    'life_summary',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _lastAdviceMeta = const VerificationMeta(
    'lastAdvice',
  );
  @override
  late final GeneratedColumn<String> lastAdvice = GeneratedColumn<String>(
    'last_advice',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _updatedAtMeta = const VerificationMeta(
    'updatedAt',
  );
  @override
  late final GeneratedColumn<DateTime> updatedAt = GeneratedColumn<DateTime>(
    'updated_at',
    aliasedName,
    false,
    type: DriftSqlType.dateTime,
    requiredDuringInsert: false,
    defaultValue: currentDateAndTime,
  );
  @override
  List<GeneratedColumn> get $columns => [
    summaryId,
    userId,
    sleepSummary,
    expenseSummary,
    lifeSummary,
    lastAdvice,
    updatedAt,
  ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'rolling_summaries';
  @override
  VerificationContext validateIntegrity(
    Insertable<RollingSummary> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('summary_id')) {
      context.handle(
        _summaryIdMeta,
        summaryId.isAcceptableOrUnknown(data['summary_id']!, _summaryIdMeta),
      );
    } else if (isInserting) {
      context.missing(_summaryIdMeta);
    }
    if (data.containsKey('user_id')) {
      context.handle(
        _userIdMeta,
        userId.isAcceptableOrUnknown(data['user_id']!, _userIdMeta),
      );
    } else if (isInserting) {
      context.missing(_userIdMeta);
    }
    if (data.containsKey('sleep_summary')) {
      context.handle(
        _sleepSummaryMeta,
        sleepSummary.isAcceptableOrUnknown(
          data['sleep_summary']!,
          _sleepSummaryMeta,
        ),
      );
    }
    if (data.containsKey('expense_summary')) {
      context.handle(
        _expenseSummaryMeta,
        expenseSummary.isAcceptableOrUnknown(
          data['expense_summary']!,
          _expenseSummaryMeta,
        ),
      );
    }
    if (data.containsKey('life_summary')) {
      context.handle(
        _lifeSummaryMeta,
        lifeSummary.isAcceptableOrUnknown(
          data['life_summary']!,
          _lifeSummaryMeta,
        ),
      );
    }
    if (data.containsKey('last_advice')) {
      context.handle(
        _lastAdviceMeta,
        lastAdvice.isAcceptableOrUnknown(data['last_advice']!, _lastAdviceMeta),
      );
    }
    if (data.containsKey('updated_at')) {
      context.handle(
        _updatedAtMeta,
        updatedAt.isAcceptableOrUnknown(data['updated_at']!, _updatedAtMeta),
      );
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {summaryId};
  @override
  RollingSummary map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return RollingSummary(
      summaryId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}summary_id'],
      )!,
      userId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}user_id'],
      )!,
      sleepSummary: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}sleep_summary'],
      ),
      expenseSummary: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}expense_summary'],
      ),
      lifeSummary: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}life_summary'],
      ),
      lastAdvice: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}last_advice'],
      ),
      updatedAt: attachedDatabase.typeMapping.read(
        DriftSqlType.dateTime,
        data['${effectivePrefix}updated_at'],
      )!,
    );
  }

  @override
  $RollingSummariesTable createAlias(String alias) {
    return $RollingSummariesTable(attachedDatabase, alias);
  }
}

class RollingSummary extends DataClass implements Insertable<RollingSummary> {
  final String summaryId;
  final String userId;
  final String? sleepSummary;
  final String? expenseSummary;
  final String? lifeSummary;
  final String? lastAdvice;
  final DateTime updatedAt;
  const RollingSummary({
    required this.summaryId,
    required this.userId,
    this.sleepSummary,
    this.expenseSummary,
    this.lifeSummary,
    this.lastAdvice,
    required this.updatedAt,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['summary_id'] = Variable<String>(summaryId);
    map['user_id'] = Variable<String>(userId);
    if (!nullToAbsent || sleepSummary != null) {
      map['sleep_summary'] = Variable<String>(sleepSummary);
    }
    if (!nullToAbsent || expenseSummary != null) {
      map['expense_summary'] = Variable<String>(expenseSummary);
    }
    if (!nullToAbsent || lifeSummary != null) {
      map['life_summary'] = Variable<String>(lifeSummary);
    }
    if (!nullToAbsent || lastAdvice != null) {
      map['last_advice'] = Variable<String>(lastAdvice);
    }
    map['updated_at'] = Variable<DateTime>(updatedAt);
    return map;
  }

  RollingSummariesCompanion toCompanion(bool nullToAbsent) {
    return RollingSummariesCompanion(
      summaryId: Value(summaryId),
      userId: Value(userId),
      sleepSummary: sleepSummary == null && nullToAbsent
          ? const Value.absent()
          : Value(sleepSummary),
      expenseSummary: expenseSummary == null && nullToAbsent
          ? const Value.absent()
          : Value(expenseSummary),
      lifeSummary: lifeSummary == null && nullToAbsent
          ? const Value.absent()
          : Value(lifeSummary),
      lastAdvice: lastAdvice == null && nullToAbsent
          ? const Value.absent()
          : Value(lastAdvice),
      updatedAt: Value(updatedAt),
    );
  }

  factory RollingSummary.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return RollingSummary(
      summaryId: serializer.fromJson<String>(json['summaryId']),
      userId: serializer.fromJson<String>(json['userId']),
      sleepSummary: serializer.fromJson<String?>(json['sleepSummary']),
      expenseSummary: serializer.fromJson<String?>(json['expenseSummary']),
      lifeSummary: serializer.fromJson<String?>(json['lifeSummary']),
      lastAdvice: serializer.fromJson<String?>(json['lastAdvice']),
      updatedAt: serializer.fromJson<DateTime>(json['updatedAt']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'summaryId': serializer.toJson<String>(summaryId),
      'userId': serializer.toJson<String>(userId),
      'sleepSummary': serializer.toJson<String?>(sleepSummary),
      'expenseSummary': serializer.toJson<String?>(expenseSummary),
      'lifeSummary': serializer.toJson<String?>(lifeSummary),
      'lastAdvice': serializer.toJson<String?>(lastAdvice),
      'updatedAt': serializer.toJson<DateTime>(updatedAt),
    };
  }

  RollingSummary copyWith({
    String? summaryId,
    String? userId,
    Value<String?> sleepSummary = const Value.absent(),
    Value<String?> expenseSummary = const Value.absent(),
    Value<String?> lifeSummary = const Value.absent(),
    Value<String?> lastAdvice = const Value.absent(),
    DateTime? updatedAt,
  }) => RollingSummary(
    summaryId: summaryId ?? this.summaryId,
    userId: userId ?? this.userId,
    sleepSummary: sleepSummary.present ? sleepSummary.value : this.sleepSummary,
    expenseSummary: expenseSummary.present
        ? expenseSummary.value
        : this.expenseSummary,
    lifeSummary: lifeSummary.present ? lifeSummary.value : this.lifeSummary,
    lastAdvice: lastAdvice.present ? lastAdvice.value : this.lastAdvice,
    updatedAt: updatedAt ?? this.updatedAt,
  );
  RollingSummary copyWithCompanion(RollingSummariesCompanion data) {
    return RollingSummary(
      summaryId: data.summaryId.present ? data.summaryId.value : this.summaryId,
      userId: data.userId.present ? data.userId.value : this.userId,
      sleepSummary: data.sleepSummary.present
          ? data.sleepSummary.value
          : this.sleepSummary,
      expenseSummary: data.expenseSummary.present
          ? data.expenseSummary.value
          : this.expenseSummary,
      lifeSummary: data.lifeSummary.present
          ? data.lifeSummary.value
          : this.lifeSummary,
      lastAdvice: data.lastAdvice.present
          ? data.lastAdvice.value
          : this.lastAdvice,
      updatedAt: data.updatedAt.present ? data.updatedAt.value : this.updatedAt,
    );
  }

  @override
  String toString() {
    return (StringBuffer('RollingSummary(')
          ..write('summaryId: $summaryId, ')
          ..write('userId: $userId, ')
          ..write('sleepSummary: $sleepSummary, ')
          ..write('expenseSummary: $expenseSummary, ')
          ..write('lifeSummary: $lifeSummary, ')
          ..write('lastAdvice: $lastAdvice, ')
          ..write('updatedAt: $updatedAt')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(
    summaryId,
    userId,
    sleepSummary,
    expenseSummary,
    lifeSummary,
    lastAdvice,
    updatedAt,
  );
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is RollingSummary &&
          other.summaryId == this.summaryId &&
          other.userId == this.userId &&
          other.sleepSummary == this.sleepSummary &&
          other.expenseSummary == this.expenseSummary &&
          other.lifeSummary == this.lifeSummary &&
          other.lastAdvice == this.lastAdvice &&
          other.updatedAt == this.updatedAt);
}

class RollingSummariesCompanion extends UpdateCompanion<RollingSummary> {
  final Value<String> summaryId;
  final Value<String> userId;
  final Value<String?> sleepSummary;
  final Value<String?> expenseSummary;
  final Value<String?> lifeSummary;
  final Value<String?> lastAdvice;
  final Value<DateTime> updatedAt;
  final Value<int> rowid;
  const RollingSummariesCompanion({
    this.summaryId = const Value.absent(),
    this.userId = const Value.absent(),
    this.sleepSummary = const Value.absent(),
    this.expenseSummary = const Value.absent(),
    this.lifeSummary = const Value.absent(),
    this.lastAdvice = const Value.absent(),
    this.updatedAt = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  RollingSummariesCompanion.insert({
    required String summaryId,
    required String userId,
    this.sleepSummary = const Value.absent(),
    this.expenseSummary = const Value.absent(),
    this.lifeSummary = const Value.absent(),
    this.lastAdvice = const Value.absent(),
    this.updatedAt = const Value.absent(),
    this.rowid = const Value.absent(),
  }) : summaryId = Value(summaryId),
       userId = Value(userId);
  static Insertable<RollingSummary> custom({
    Expression<String>? summaryId,
    Expression<String>? userId,
    Expression<String>? sleepSummary,
    Expression<String>? expenseSummary,
    Expression<String>? lifeSummary,
    Expression<String>? lastAdvice,
    Expression<DateTime>? updatedAt,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (summaryId != null) 'summary_id': summaryId,
      if (userId != null) 'user_id': userId,
      if (sleepSummary != null) 'sleep_summary': sleepSummary,
      if (expenseSummary != null) 'expense_summary': expenseSummary,
      if (lifeSummary != null) 'life_summary': lifeSummary,
      if (lastAdvice != null) 'last_advice': lastAdvice,
      if (updatedAt != null) 'updated_at': updatedAt,
      if (rowid != null) 'rowid': rowid,
    });
  }

  RollingSummariesCompanion copyWith({
    Value<String>? summaryId,
    Value<String>? userId,
    Value<String?>? sleepSummary,
    Value<String?>? expenseSummary,
    Value<String?>? lifeSummary,
    Value<String?>? lastAdvice,
    Value<DateTime>? updatedAt,
    Value<int>? rowid,
  }) {
    return RollingSummariesCompanion(
      summaryId: summaryId ?? this.summaryId,
      userId: userId ?? this.userId,
      sleepSummary: sleepSummary ?? this.sleepSummary,
      expenseSummary: expenseSummary ?? this.expenseSummary,
      lifeSummary: lifeSummary ?? this.lifeSummary,
      lastAdvice: lastAdvice ?? this.lastAdvice,
      updatedAt: updatedAt ?? this.updatedAt,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (summaryId.present) {
      map['summary_id'] = Variable<String>(summaryId.value);
    }
    if (userId.present) {
      map['user_id'] = Variable<String>(userId.value);
    }
    if (sleepSummary.present) {
      map['sleep_summary'] = Variable<String>(sleepSummary.value);
    }
    if (expenseSummary.present) {
      map['expense_summary'] = Variable<String>(expenseSummary.value);
    }
    if (lifeSummary.present) {
      map['life_summary'] = Variable<String>(lifeSummary.value);
    }
    if (lastAdvice.present) {
      map['last_advice'] = Variable<String>(lastAdvice.value);
    }
    if (updatedAt.present) {
      map['updated_at'] = Variable<DateTime>(updatedAt.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('RollingSummariesCompanion(')
          ..write('summaryId: $summaryId, ')
          ..write('userId: $userId, ')
          ..write('sleepSummary: $sleepSummary, ')
          ..write('expenseSummary: $expenseSummary, ')
          ..write('lifeSummary: $lifeSummary, ')
          ..write('lastAdvice: $lastAdvice, ')
          ..write('updatedAt: $updatedAt, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $TripsTable extends Trips with TableInfo<$TripsTable, Trip> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $TripsTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _tripIdMeta = const VerificationMeta('tripId');
  @override
  late final GeneratedColumn<String> tripId = GeneratedColumn<String>(
    'trip_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _userIdMeta = const VerificationMeta('userId');
  @override
  late final GeneratedColumn<String> userId = GeneratedColumn<String>(
    'user_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _nameMeta = const VerificationMeta('name');
  @override
  late final GeneratedColumn<String> name = GeneratedColumn<String>(
    'name',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _destinationMeta = const VerificationMeta(
    'destination',
  );
  @override
  late final GeneratedColumn<String> destination = GeneratedColumn<String>(
    'destination',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _startDateMeta = const VerificationMeta(
    'startDate',
  );
  @override
  late final GeneratedColumn<DateTime> startDate = GeneratedColumn<DateTime>(
    'start_date',
    aliasedName,
    false,
    type: DriftSqlType.dateTime,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _endDateMeta = const VerificationMeta(
    'endDate',
  );
  @override
  late final GeneratedColumn<DateTime> endDate = GeneratedColumn<DateTime>(
    'end_date',
    aliasedName,
    false,
    type: DriftSqlType.dateTime,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _budgetTotalMeta = const VerificationMeta(
    'budgetTotal',
  );
  @override
  late final GeneratedColumn<int> budgetTotal = GeneratedColumn<int>(
    'budget_total',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
    defaultValue: const Constant(0),
  );
  static const VerificationMeta _budgetJsonMeta = const VerificationMeta(
    'budgetJson',
  );
  @override
  late final GeneratedColumn<String> budgetJson = GeneratedColumn<String>(
    'budget_json',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
    defaultValue: const Constant('{}'),
  );
  static const VerificationMeta _statusMeta = const VerificationMeta('status');
  @override
  late final GeneratedColumn<String> status = GeneratedColumn<String>(
    'status',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
    defaultValue: const Constant('planning'),
  );
  static const VerificationMeta _ratingMeta = const VerificationMeta('rating');
  @override
  late final GeneratedColumn<int> rating = GeneratedColumn<int>(
    'rating',
    aliasedName,
    true,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _reviewMeta = const VerificationMeta('review');
  @override
  late final GeneratedColumn<String> review = GeneratedColumn<String>(
    'review',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _llmSummaryMeta = const VerificationMeta(
    'llmSummary',
  );
  @override
  late final GeneratedColumn<String> llmSummary = GeneratedColumn<String>(
    'llm_summary',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _reviewPhotosJsonMeta = const VerificationMeta(
    'reviewPhotosJson',
  );
  @override
  late final GeneratedColumn<String> reviewPhotosJson = GeneratedColumn<String>(
    'review_photos_json',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _createdAtMeta = const VerificationMeta(
    'createdAt',
  );
  @override
  late final GeneratedColumn<DateTime> createdAt = GeneratedColumn<DateTime>(
    'created_at',
    aliasedName,
    false,
    type: DriftSqlType.dateTime,
    requiredDuringInsert: false,
    defaultValue: currentDateAndTime,
  );
  @override
  List<GeneratedColumn> get $columns => [
    tripId,
    userId,
    name,
    destination,
    startDate,
    endDate,
    budgetTotal,
    budgetJson,
    status,
    rating,
    review,
    llmSummary,
    reviewPhotosJson,
    createdAt,
  ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'trips';
  @override
  VerificationContext validateIntegrity(
    Insertable<Trip> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('trip_id')) {
      context.handle(
        _tripIdMeta,
        tripId.isAcceptableOrUnknown(data['trip_id']!, _tripIdMeta),
      );
    } else if (isInserting) {
      context.missing(_tripIdMeta);
    }
    if (data.containsKey('user_id')) {
      context.handle(
        _userIdMeta,
        userId.isAcceptableOrUnknown(data['user_id']!, _userIdMeta),
      );
    } else if (isInserting) {
      context.missing(_userIdMeta);
    }
    if (data.containsKey('name')) {
      context.handle(
        _nameMeta,
        name.isAcceptableOrUnknown(data['name']!, _nameMeta),
      );
    } else if (isInserting) {
      context.missing(_nameMeta);
    }
    if (data.containsKey('destination')) {
      context.handle(
        _destinationMeta,
        destination.isAcceptableOrUnknown(
          data['destination']!,
          _destinationMeta,
        ),
      );
    } else if (isInserting) {
      context.missing(_destinationMeta);
    }
    if (data.containsKey('start_date')) {
      context.handle(
        _startDateMeta,
        startDate.isAcceptableOrUnknown(data['start_date']!, _startDateMeta),
      );
    } else if (isInserting) {
      context.missing(_startDateMeta);
    }
    if (data.containsKey('end_date')) {
      context.handle(
        _endDateMeta,
        endDate.isAcceptableOrUnknown(data['end_date']!, _endDateMeta),
      );
    } else if (isInserting) {
      context.missing(_endDateMeta);
    }
    if (data.containsKey('budget_total')) {
      context.handle(
        _budgetTotalMeta,
        budgetTotal.isAcceptableOrUnknown(
          data['budget_total']!,
          _budgetTotalMeta,
        ),
      );
    }
    if (data.containsKey('budget_json')) {
      context.handle(
        _budgetJsonMeta,
        budgetJson.isAcceptableOrUnknown(data['budget_json']!, _budgetJsonMeta),
      );
    }
    if (data.containsKey('status')) {
      context.handle(
        _statusMeta,
        status.isAcceptableOrUnknown(data['status']!, _statusMeta),
      );
    }
    if (data.containsKey('rating')) {
      context.handle(
        _ratingMeta,
        rating.isAcceptableOrUnknown(data['rating']!, _ratingMeta),
      );
    }
    if (data.containsKey('review')) {
      context.handle(
        _reviewMeta,
        review.isAcceptableOrUnknown(data['review']!, _reviewMeta),
      );
    }
    if (data.containsKey('llm_summary')) {
      context.handle(
        _llmSummaryMeta,
        llmSummary.isAcceptableOrUnknown(data['llm_summary']!, _llmSummaryMeta),
      );
    }
    if (data.containsKey('review_photos_json')) {
      context.handle(
        _reviewPhotosJsonMeta,
        reviewPhotosJson.isAcceptableOrUnknown(
          data['review_photos_json']!,
          _reviewPhotosJsonMeta,
        ),
      );
    }
    if (data.containsKey('created_at')) {
      context.handle(
        _createdAtMeta,
        createdAt.isAcceptableOrUnknown(data['created_at']!, _createdAtMeta),
      );
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {tripId};
  @override
  Trip map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return Trip(
      tripId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}trip_id'],
      )!,
      userId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}user_id'],
      )!,
      name: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}name'],
      )!,
      destination: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}destination'],
      )!,
      startDate: attachedDatabase.typeMapping.read(
        DriftSqlType.dateTime,
        data['${effectivePrefix}start_date'],
      )!,
      endDate: attachedDatabase.typeMapping.read(
        DriftSqlType.dateTime,
        data['${effectivePrefix}end_date'],
      )!,
      budgetTotal: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}budget_total'],
      )!,
      budgetJson: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}budget_json'],
      )!,
      status: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}status'],
      )!,
      rating: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}rating'],
      ),
      review: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}review'],
      ),
      llmSummary: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}llm_summary'],
      ),
      reviewPhotosJson: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}review_photos_json'],
      ),
      createdAt: attachedDatabase.typeMapping.read(
        DriftSqlType.dateTime,
        data['${effectivePrefix}created_at'],
      )!,
    );
  }

  @override
  $TripsTable createAlias(String alias) {
    return $TripsTable(attachedDatabase, alias);
  }
}

class Trip extends DataClass implements Insertable<Trip> {
  final String tripId;
  final String userId;
  final String name;
  final String destination;
  final DateTime startDate;
  final DateTime endDate;
  final int budgetTotal;
  final String budgetJson;
  final String status;
  final int? rating;
  final String? review;
  final String? llmSummary;
  final String? reviewPhotosJson;
  final DateTime createdAt;
  const Trip({
    required this.tripId,
    required this.userId,
    required this.name,
    required this.destination,
    required this.startDate,
    required this.endDate,
    required this.budgetTotal,
    required this.budgetJson,
    required this.status,
    this.rating,
    this.review,
    this.llmSummary,
    this.reviewPhotosJson,
    required this.createdAt,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['trip_id'] = Variable<String>(tripId);
    map['user_id'] = Variable<String>(userId);
    map['name'] = Variable<String>(name);
    map['destination'] = Variable<String>(destination);
    map['start_date'] = Variable<DateTime>(startDate);
    map['end_date'] = Variable<DateTime>(endDate);
    map['budget_total'] = Variable<int>(budgetTotal);
    map['budget_json'] = Variable<String>(budgetJson);
    map['status'] = Variable<String>(status);
    if (!nullToAbsent || rating != null) {
      map['rating'] = Variable<int>(rating);
    }
    if (!nullToAbsent || review != null) {
      map['review'] = Variable<String>(review);
    }
    if (!nullToAbsent || llmSummary != null) {
      map['llm_summary'] = Variable<String>(llmSummary);
    }
    if (!nullToAbsent || reviewPhotosJson != null) {
      map['review_photos_json'] = Variable<String>(reviewPhotosJson);
    }
    map['created_at'] = Variable<DateTime>(createdAt);
    return map;
  }

  TripsCompanion toCompanion(bool nullToAbsent) {
    return TripsCompanion(
      tripId: Value(tripId),
      userId: Value(userId),
      name: Value(name),
      destination: Value(destination),
      startDate: Value(startDate),
      endDate: Value(endDate),
      budgetTotal: Value(budgetTotal),
      budgetJson: Value(budgetJson),
      status: Value(status),
      rating: rating == null && nullToAbsent
          ? const Value.absent()
          : Value(rating),
      review: review == null && nullToAbsent
          ? const Value.absent()
          : Value(review),
      llmSummary: llmSummary == null && nullToAbsent
          ? const Value.absent()
          : Value(llmSummary),
      reviewPhotosJson: reviewPhotosJson == null && nullToAbsent
          ? const Value.absent()
          : Value(reviewPhotosJson),
      createdAt: Value(createdAt),
    );
  }

  factory Trip.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return Trip(
      tripId: serializer.fromJson<String>(json['tripId']),
      userId: serializer.fromJson<String>(json['userId']),
      name: serializer.fromJson<String>(json['name']),
      destination: serializer.fromJson<String>(json['destination']),
      startDate: serializer.fromJson<DateTime>(json['startDate']),
      endDate: serializer.fromJson<DateTime>(json['endDate']),
      budgetTotal: serializer.fromJson<int>(json['budgetTotal']),
      budgetJson: serializer.fromJson<String>(json['budgetJson']),
      status: serializer.fromJson<String>(json['status']),
      rating: serializer.fromJson<int?>(json['rating']),
      review: serializer.fromJson<String?>(json['review']),
      llmSummary: serializer.fromJson<String?>(json['llmSummary']),
      reviewPhotosJson: serializer.fromJson<String?>(json['reviewPhotosJson']),
      createdAt: serializer.fromJson<DateTime>(json['createdAt']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'tripId': serializer.toJson<String>(tripId),
      'userId': serializer.toJson<String>(userId),
      'name': serializer.toJson<String>(name),
      'destination': serializer.toJson<String>(destination),
      'startDate': serializer.toJson<DateTime>(startDate),
      'endDate': serializer.toJson<DateTime>(endDate),
      'budgetTotal': serializer.toJson<int>(budgetTotal),
      'budgetJson': serializer.toJson<String>(budgetJson),
      'status': serializer.toJson<String>(status),
      'rating': serializer.toJson<int?>(rating),
      'review': serializer.toJson<String?>(review),
      'llmSummary': serializer.toJson<String?>(llmSummary),
      'reviewPhotosJson': serializer.toJson<String?>(reviewPhotosJson),
      'createdAt': serializer.toJson<DateTime>(createdAt),
    };
  }

  Trip copyWith({
    String? tripId,
    String? userId,
    String? name,
    String? destination,
    DateTime? startDate,
    DateTime? endDate,
    int? budgetTotal,
    String? budgetJson,
    String? status,
    Value<int?> rating = const Value.absent(),
    Value<String?> review = const Value.absent(),
    Value<String?> llmSummary = const Value.absent(),
    Value<String?> reviewPhotosJson = const Value.absent(),
    DateTime? createdAt,
  }) => Trip(
    tripId: tripId ?? this.tripId,
    userId: userId ?? this.userId,
    name: name ?? this.name,
    destination: destination ?? this.destination,
    startDate: startDate ?? this.startDate,
    endDate: endDate ?? this.endDate,
    budgetTotal: budgetTotal ?? this.budgetTotal,
    budgetJson: budgetJson ?? this.budgetJson,
    status: status ?? this.status,
    rating: rating.present ? rating.value : this.rating,
    review: review.present ? review.value : this.review,
    llmSummary: llmSummary.present ? llmSummary.value : this.llmSummary,
    reviewPhotosJson: reviewPhotosJson.present
        ? reviewPhotosJson.value
        : this.reviewPhotosJson,
    createdAt: createdAt ?? this.createdAt,
  );
  Trip copyWithCompanion(TripsCompanion data) {
    return Trip(
      tripId: data.tripId.present ? data.tripId.value : this.tripId,
      userId: data.userId.present ? data.userId.value : this.userId,
      name: data.name.present ? data.name.value : this.name,
      destination: data.destination.present
          ? data.destination.value
          : this.destination,
      startDate: data.startDate.present ? data.startDate.value : this.startDate,
      endDate: data.endDate.present ? data.endDate.value : this.endDate,
      budgetTotal: data.budgetTotal.present
          ? data.budgetTotal.value
          : this.budgetTotal,
      budgetJson: data.budgetJson.present
          ? data.budgetJson.value
          : this.budgetJson,
      status: data.status.present ? data.status.value : this.status,
      rating: data.rating.present ? data.rating.value : this.rating,
      review: data.review.present ? data.review.value : this.review,
      llmSummary: data.llmSummary.present
          ? data.llmSummary.value
          : this.llmSummary,
      reviewPhotosJson: data.reviewPhotosJson.present
          ? data.reviewPhotosJson.value
          : this.reviewPhotosJson,
      createdAt: data.createdAt.present ? data.createdAt.value : this.createdAt,
    );
  }

  @override
  String toString() {
    return (StringBuffer('Trip(')
          ..write('tripId: $tripId, ')
          ..write('userId: $userId, ')
          ..write('name: $name, ')
          ..write('destination: $destination, ')
          ..write('startDate: $startDate, ')
          ..write('endDate: $endDate, ')
          ..write('budgetTotal: $budgetTotal, ')
          ..write('budgetJson: $budgetJson, ')
          ..write('status: $status, ')
          ..write('rating: $rating, ')
          ..write('review: $review, ')
          ..write('llmSummary: $llmSummary, ')
          ..write('reviewPhotosJson: $reviewPhotosJson, ')
          ..write('createdAt: $createdAt')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(
    tripId,
    userId,
    name,
    destination,
    startDate,
    endDate,
    budgetTotal,
    budgetJson,
    status,
    rating,
    review,
    llmSummary,
    reviewPhotosJson,
    createdAt,
  );
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is Trip &&
          other.tripId == this.tripId &&
          other.userId == this.userId &&
          other.name == this.name &&
          other.destination == this.destination &&
          other.startDate == this.startDate &&
          other.endDate == this.endDate &&
          other.budgetTotal == this.budgetTotal &&
          other.budgetJson == this.budgetJson &&
          other.status == this.status &&
          other.rating == this.rating &&
          other.review == this.review &&
          other.llmSummary == this.llmSummary &&
          other.reviewPhotosJson == this.reviewPhotosJson &&
          other.createdAt == this.createdAt);
}

class TripsCompanion extends UpdateCompanion<Trip> {
  final Value<String> tripId;
  final Value<String> userId;
  final Value<String> name;
  final Value<String> destination;
  final Value<DateTime> startDate;
  final Value<DateTime> endDate;
  final Value<int> budgetTotal;
  final Value<String> budgetJson;
  final Value<String> status;
  final Value<int?> rating;
  final Value<String?> review;
  final Value<String?> llmSummary;
  final Value<String?> reviewPhotosJson;
  final Value<DateTime> createdAt;
  final Value<int> rowid;
  const TripsCompanion({
    this.tripId = const Value.absent(),
    this.userId = const Value.absent(),
    this.name = const Value.absent(),
    this.destination = const Value.absent(),
    this.startDate = const Value.absent(),
    this.endDate = const Value.absent(),
    this.budgetTotal = const Value.absent(),
    this.budgetJson = const Value.absent(),
    this.status = const Value.absent(),
    this.rating = const Value.absent(),
    this.review = const Value.absent(),
    this.llmSummary = const Value.absent(),
    this.reviewPhotosJson = const Value.absent(),
    this.createdAt = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  TripsCompanion.insert({
    required String tripId,
    required String userId,
    required String name,
    required String destination,
    required DateTime startDate,
    required DateTime endDate,
    this.budgetTotal = const Value.absent(),
    this.budgetJson = const Value.absent(),
    this.status = const Value.absent(),
    this.rating = const Value.absent(),
    this.review = const Value.absent(),
    this.llmSummary = const Value.absent(),
    this.reviewPhotosJson = const Value.absent(),
    this.createdAt = const Value.absent(),
    this.rowid = const Value.absent(),
  }) : tripId = Value(tripId),
       userId = Value(userId),
       name = Value(name),
       destination = Value(destination),
       startDate = Value(startDate),
       endDate = Value(endDate);
  static Insertable<Trip> custom({
    Expression<String>? tripId,
    Expression<String>? userId,
    Expression<String>? name,
    Expression<String>? destination,
    Expression<DateTime>? startDate,
    Expression<DateTime>? endDate,
    Expression<int>? budgetTotal,
    Expression<String>? budgetJson,
    Expression<String>? status,
    Expression<int>? rating,
    Expression<String>? review,
    Expression<String>? llmSummary,
    Expression<String>? reviewPhotosJson,
    Expression<DateTime>? createdAt,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (tripId != null) 'trip_id': tripId,
      if (userId != null) 'user_id': userId,
      if (name != null) 'name': name,
      if (destination != null) 'destination': destination,
      if (startDate != null) 'start_date': startDate,
      if (endDate != null) 'end_date': endDate,
      if (budgetTotal != null) 'budget_total': budgetTotal,
      if (budgetJson != null) 'budget_json': budgetJson,
      if (status != null) 'status': status,
      if (rating != null) 'rating': rating,
      if (review != null) 'review': review,
      if (llmSummary != null) 'llm_summary': llmSummary,
      if (reviewPhotosJson != null) 'review_photos_json': reviewPhotosJson,
      if (createdAt != null) 'created_at': createdAt,
      if (rowid != null) 'rowid': rowid,
    });
  }

  TripsCompanion copyWith({
    Value<String>? tripId,
    Value<String>? userId,
    Value<String>? name,
    Value<String>? destination,
    Value<DateTime>? startDate,
    Value<DateTime>? endDate,
    Value<int>? budgetTotal,
    Value<String>? budgetJson,
    Value<String>? status,
    Value<int?>? rating,
    Value<String?>? review,
    Value<String?>? llmSummary,
    Value<String?>? reviewPhotosJson,
    Value<DateTime>? createdAt,
    Value<int>? rowid,
  }) {
    return TripsCompanion(
      tripId: tripId ?? this.tripId,
      userId: userId ?? this.userId,
      name: name ?? this.name,
      destination: destination ?? this.destination,
      startDate: startDate ?? this.startDate,
      endDate: endDate ?? this.endDate,
      budgetTotal: budgetTotal ?? this.budgetTotal,
      budgetJson: budgetJson ?? this.budgetJson,
      status: status ?? this.status,
      rating: rating ?? this.rating,
      review: review ?? this.review,
      llmSummary: llmSummary ?? this.llmSummary,
      reviewPhotosJson: reviewPhotosJson ?? this.reviewPhotosJson,
      createdAt: createdAt ?? this.createdAt,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (tripId.present) {
      map['trip_id'] = Variable<String>(tripId.value);
    }
    if (userId.present) {
      map['user_id'] = Variable<String>(userId.value);
    }
    if (name.present) {
      map['name'] = Variable<String>(name.value);
    }
    if (destination.present) {
      map['destination'] = Variable<String>(destination.value);
    }
    if (startDate.present) {
      map['start_date'] = Variable<DateTime>(startDate.value);
    }
    if (endDate.present) {
      map['end_date'] = Variable<DateTime>(endDate.value);
    }
    if (budgetTotal.present) {
      map['budget_total'] = Variable<int>(budgetTotal.value);
    }
    if (budgetJson.present) {
      map['budget_json'] = Variable<String>(budgetJson.value);
    }
    if (status.present) {
      map['status'] = Variable<String>(status.value);
    }
    if (rating.present) {
      map['rating'] = Variable<int>(rating.value);
    }
    if (review.present) {
      map['review'] = Variable<String>(review.value);
    }
    if (llmSummary.present) {
      map['llm_summary'] = Variable<String>(llmSummary.value);
    }
    if (reviewPhotosJson.present) {
      map['review_photos_json'] = Variable<String>(reviewPhotosJson.value);
    }
    if (createdAt.present) {
      map['created_at'] = Variable<DateTime>(createdAt.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('TripsCompanion(')
          ..write('tripId: $tripId, ')
          ..write('userId: $userId, ')
          ..write('name: $name, ')
          ..write('destination: $destination, ')
          ..write('startDate: $startDate, ')
          ..write('endDate: $endDate, ')
          ..write('budgetTotal: $budgetTotal, ')
          ..write('budgetJson: $budgetJson, ')
          ..write('status: $status, ')
          ..write('rating: $rating, ')
          ..write('review: $review, ')
          ..write('llmSummary: $llmSummary, ')
          ..write('reviewPhotosJson: $reviewPhotosJson, ')
          ..write('createdAt: $createdAt, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $TripDayPlansTable extends TripDayPlans
    with TableInfo<$TripDayPlansTable, TripDayPlan> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $TripDayPlansTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _planIdMeta = const VerificationMeta('planId');
  @override
  late final GeneratedColumn<String> planId = GeneratedColumn<String>(
    'plan_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _tripIdMeta = const VerificationMeta('tripId');
  @override
  late final GeneratedColumn<String> tripId = GeneratedColumn<String>(
    'trip_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _dateMeta = const VerificationMeta('date');
  @override
  late final GeneratedColumn<DateTime> date = GeneratedColumn<DateTime>(
    'date',
    aliasedName,
    false,
    type: DriftSqlType.dateTime,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _originalTitleMeta = const VerificationMeta(
    'originalTitle',
  );
  @override
  late final GeneratedColumn<String> originalTitle = GeneratedColumn<String>(
    'original_title',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _titleMeta = const VerificationMeta('title');
  @override
  late final GeneratedColumn<String> title = GeneratedColumn<String>(
    'title',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _contentMeta = const VerificationMeta(
    'content',
  );
  @override
  late final GeneratedColumn<String> content = GeneratedColumn<String>(
    'content',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _statusMeta = const VerificationMeta('status');
  @override
  late final GeneratedColumn<String> status = GeneratedColumn<String>(
    'status',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
    defaultValue: const Constant('pending'),
  );
  static const VerificationMeta _actualNoteMeta = const VerificationMeta(
    'actualNote',
  );
  @override
  late final GeneratedColumn<String> actualNote = GeneratedColumn<String>(
    'actual_note',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _photoUriMeta = const VerificationMeta(
    'photoUri',
  );
  @override
  late final GeneratedColumn<String> photoUri = GeneratedColumn<String>(
    'photo_uri',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _sortOrderMeta = const VerificationMeta(
    'sortOrder',
  );
  @override
  late final GeneratedColumn<int> sortOrder = GeneratedColumn<int>(
    'sort_order',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
    defaultValue: const Constant(0),
  );
  static const VerificationMeta _createdAtMeta = const VerificationMeta(
    'createdAt',
  );
  @override
  late final GeneratedColumn<DateTime> createdAt = GeneratedColumn<DateTime>(
    'created_at',
    aliasedName,
    false,
    type: DriftSqlType.dateTime,
    requiredDuringInsert: false,
    defaultValue: currentDateAndTime,
  );
  @override
  List<GeneratedColumn> get $columns => [
    planId,
    tripId,
    date,
    originalTitle,
    title,
    content,
    status,
    actualNote,
    photoUri,
    sortOrder,
    createdAt,
  ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'trip_day_plans';
  @override
  VerificationContext validateIntegrity(
    Insertable<TripDayPlan> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('plan_id')) {
      context.handle(
        _planIdMeta,
        planId.isAcceptableOrUnknown(data['plan_id']!, _planIdMeta),
      );
    } else if (isInserting) {
      context.missing(_planIdMeta);
    }
    if (data.containsKey('trip_id')) {
      context.handle(
        _tripIdMeta,
        tripId.isAcceptableOrUnknown(data['trip_id']!, _tripIdMeta),
      );
    } else if (isInserting) {
      context.missing(_tripIdMeta);
    }
    if (data.containsKey('date')) {
      context.handle(
        _dateMeta,
        date.isAcceptableOrUnknown(data['date']!, _dateMeta),
      );
    } else if (isInserting) {
      context.missing(_dateMeta);
    }
    if (data.containsKey('original_title')) {
      context.handle(
        _originalTitleMeta,
        originalTitle.isAcceptableOrUnknown(
          data['original_title']!,
          _originalTitleMeta,
        ),
      );
    }
    if (data.containsKey('title')) {
      context.handle(
        _titleMeta,
        title.isAcceptableOrUnknown(data['title']!, _titleMeta),
      );
    } else if (isInserting) {
      context.missing(_titleMeta);
    }
    if (data.containsKey('content')) {
      context.handle(
        _contentMeta,
        content.isAcceptableOrUnknown(data['content']!, _contentMeta),
      );
    }
    if (data.containsKey('status')) {
      context.handle(
        _statusMeta,
        status.isAcceptableOrUnknown(data['status']!, _statusMeta),
      );
    }
    if (data.containsKey('actual_note')) {
      context.handle(
        _actualNoteMeta,
        actualNote.isAcceptableOrUnknown(data['actual_note']!, _actualNoteMeta),
      );
    }
    if (data.containsKey('photo_uri')) {
      context.handle(
        _photoUriMeta,
        photoUri.isAcceptableOrUnknown(data['photo_uri']!, _photoUriMeta),
      );
    }
    if (data.containsKey('sort_order')) {
      context.handle(
        _sortOrderMeta,
        sortOrder.isAcceptableOrUnknown(data['sort_order']!, _sortOrderMeta),
      );
    }
    if (data.containsKey('created_at')) {
      context.handle(
        _createdAtMeta,
        createdAt.isAcceptableOrUnknown(data['created_at']!, _createdAtMeta),
      );
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {planId};
  @override
  TripDayPlan map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return TripDayPlan(
      planId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}plan_id'],
      )!,
      tripId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}trip_id'],
      )!,
      date: attachedDatabase.typeMapping.read(
        DriftSqlType.dateTime,
        data['${effectivePrefix}date'],
      )!,
      originalTitle: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}original_title'],
      ),
      title: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}title'],
      )!,
      content: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}content'],
      ),
      status: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}status'],
      )!,
      actualNote: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}actual_note'],
      ),
      photoUri: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}photo_uri'],
      ),
      sortOrder: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}sort_order'],
      )!,
      createdAt: attachedDatabase.typeMapping.read(
        DriftSqlType.dateTime,
        data['${effectivePrefix}created_at'],
      )!,
    );
  }

  @override
  $TripDayPlansTable createAlias(String alias) {
    return $TripDayPlansTable(attachedDatabase, alias);
  }
}

class TripDayPlan extends DataClass implements Insertable<TripDayPlan> {
  final String planId;
  final String tripId;
  final DateTime date;
  final String? originalTitle;
  final String title;
  final String? content;
  final String status;
  final String? actualNote;
  final String? photoUri;
  final int sortOrder;
  final DateTime createdAt;
  const TripDayPlan({
    required this.planId,
    required this.tripId,
    required this.date,
    this.originalTitle,
    required this.title,
    this.content,
    required this.status,
    this.actualNote,
    this.photoUri,
    required this.sortOrder,
    required this.createdAt,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['plan_id'] = Variable<String>(planId);
    map['trip_id'] = Variable<String>(tripId);
    map['date'] = Variable<DateTime>(date);
    if (!nullToAbsent || originalTitle != null) {
      map['original_title'] = Variable<String>(originalTitle);
    }
    map['title'] = Variable<String>(title);
    if (!nullToAbsent || content != null) {
      map['content'] = Variable<String>(content);
    }
    map['status'] = Variable<String>(status);
    if (!nullToAbsent || actualNote != null) {
      map['actual_note'] = Variable<String>(actualNote);
    }
    if (!nullToAbsent || photoUri != null) {
      map['photo_uri'] = Variable<String>(photoUri);
    }
    map['sort_order'] = Variable<int>(sortOrder);
    map['created_at'] = Variable<DateTime>(createdAt);
    return map;
  }

  TripDayPlansCompanion toCompanion(bool nullToAbsent) {
    return TripDayPlansCompanion(
      planId: Value(planId),
      tripId: Value(tripId),
      date: Value(date),
      originalTitle: originalTitle == null && nullToAbsent
          ? const Value.absent()
          : Value(originalTitle),
      title: Value(title),
      content: content == null && nullToAbsent
          ? const Value.absent()
          : Value(content),
      status: Value(status),
      actualNote: actualNote == null && nullToAbsent
          ? const Value.absent()
          : Value(actualNote),
      photoUri: photoUri == null && nullToAbsent
          ? const Value.absent()
          : Value(photoUri),
      sortOrder: Value(sortOrder),
      createdAt: Value(createdAt),
    );
  }

  factory TripDayPlan.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return TripDayPlan(
      planId: serializer.fromJson<String>(json['planId']),
      tripId: serializer.fromJson<String>(json['tripId']),
      date: serializer.fromJson<DateTime>(json['date']),
      originalTitle: serializer.fromJson<String?>(json['originalTitle']),
      title: serializer.fromJson<String>(json['title']),
      content: serializer.fromJson<String?>(json['content']),
      status: serializer.fromJson<String>(json['status']),
      actualNote: serializer.fromJson<String?>(json['actualNote']),
      photoUri: serializer.fromJson<String?>(json['photoUri']),
      sortOrder: serializer.fromJson<int>(json['sortOrder']),
      createdAt: serializer.fromJson<DateTime>(json['createdAt']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'planId': serializer.toJson<String>(planId),
      'tripId': serializer.toJson<String>(tripId),
      'date': serializer.toJson<DateTime>(date),
      'originalTitle': serializer.toJson<String?>(originalTitle),
      'title': serializer.toJson<String>(title),
      'content': serializer.toJson<String?>(content),
      'status': serializer.toJson<String>(status),
      'actualNote': serializer.toJson<String?>(actualNote),
      'photoUri': serializer.toJson<String?>(photoUri),
      'sortOrder': serializer.toJson<int>(sortOrder),
      'createdAt': serializer.toJson<DateTime>(createdAt),
    };
  }

  TripDayPlan copyWith({
    String? planId,
    String? tripId,
    DateTime? date,
    Value<String?> originalTitle = const Value.absent(),
    String? title,
    Value<String?> content = const Value.absent(),
    String? status,
    Value<String?> actualNote = const Value.absent(),
    Value<String?> photoUri = const Value.absent(),
    int? sortOrder,
    DateTime? createdAt,
  }) => TripDayPlan(
    planId: planId ?? this.planId,
    tripId: tripId ?? this.tripId,
    date: date ?? this.date,
    originalTitle: originalTitle.present
        ? originalTitle.value
        : this.originalTitle,
    title: title ?? this.title,
    content: content.present ? content.value : this.content,
    status: status ?? this.status,
    actualNote: actualNote.present ? actualNote.value : this.actualNote,
    photoUri: photoUri.present ? photoUri.value : this.photoUri,
    sortOrder: sortOrder ?? this.sortOrder,
    createdAt: createdAt ?? this.createdAt,
  );
  TripDayPlan copyWithCompanion(TripDayPlansCompanion data) {
    return TripDayPlan(
      planId: data.planId.present ? data.planId.value : this.planId,
      tripId: data.tripId.present ? data.tripId.value : this.tripId,
      date: data.date.present ? data.date.value : this.date,
      originalTitle: data.originalTitle.present
          ? data.originalTitle.value
          : this.originalTitle,
      title: data.title.present ? data.title.value : this.title,
      content: data.content.present ? data.content.value : this.content,
      status: data.status.present ? data.status.value : this.status,
      actualNote: data.actualNote.present
          ? data.actualNote.value
          : this.actualNote,
      photoUri: data.photoUri.present ? data.photoUri.value : this.photoUri,
      sortOrder: data.sortOrder.present ? data.sortOrder.value : this.sortOrder,
      createdAt: data.createdAt.present ? data.createdAt.value : this.createdAt,
    );
  }

  @override
  String toString() {
    return (StringBuffer('TripDayPlan(')
          ..write('planId: $planId, ')
          ..write('tripId: $tripId, ')
          ..write('date: $date, ')
          ..write('originalTitle: $originalTitle, ')
          ..write('title: $title, ')
          ..write('content: $content, ')
          ..write('status: $status, ')
          ..write('actualNote: $actualNote, ')
          ..write('photoUri: $photoUri, ')
          ..write('sortOrder: $sortOrder, ')
          ..write('createdAt: $createdAt')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(
    planId,
    tripId,
    date,
    originalTitle,
    title,
    content,
    status,
    actualNote,
    photoUri,
    sortOrder,
    createdAt,
  );
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is TripDayPlan &&
          other.planId == this.planId &&
          other.tripId == this.tripId &&
          other.date == this.date &&
          other.originalTitle == this.originalTitle &&
          other.title == this.title &&
          other.content == this.content &&
          other.status == this.status &&
          other.actualNote == this.actualNote &&
          other.photoUri == this.photoUri &&
          other.sortOrder == this.sortOrder &&
          other.createdAt == this.createdAt);
}

class TripDayPlansCompanion extends UpdateCompanion<TripDayPlan> {
  final Value<String> planId;
  final Value<String> tripId;
  final Value<DateTime> date;
  final Value<String?> originalTitle;
  final Value<String> title;
  final Value<String?> content;
  final Value<String> status;
  final Value<String?> actualNote;
  final Value<String?> photoUri;
  final Value<int> sortOrder;
  final Value<DateTime> createdAt;
  final Value<int> rowid;
  const TripDayPlansCompanion({
    this.planId = const Value.absent(),
    this.tripId = const Value.absent(),
    this.date = const Value.absent(),
    this.originalTitle = const Value.absent(),
    this.title = const Value.absent(),
    this.content = const Value.absent(),
    this.status = const Value.absent(),
    this.actualNote = const Value.absent(),
    this.photoUri = const Value.absent(),
    this.sortOrder = const Value.absent(),
    this.createdAt = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  TripDayPlansCompanion.insert({
    required String planId,
    required String tripId,
    required DateTime date,
    this.originalTitle = const Value.absent(),
    required String title,
    this.content = const Value.absent(),
    this.status = const Value.absent(),
    this.actualNote = const Value.absent(),
    this.photoUri = const Value.absent(),
    this.sortOrder = const Value.absent(),
    this.createdAt = const Value.absent(),
    this.rowid = const Value.absent(),
  }) : planId = Value(planId),
       tripId = Value(tripId),
       date = Value(date),
       title = Value(title);
  static Insertable<TripDayPlan> custom({
    Expression<String>? planId,
    Expression<String>? tripId,
    Expression<DateTime>? date,
    Expression<String>? originalTitle,
    Expression<String>? title,
    Expression<String>? content,
    Expression<String>? status,
    Expression<String>? actualNote,
    Expression<String>? photoUri,
    Expression<int>? sortOrder,
    Expression<DateTime>? createdAt,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (planId != null) 'plan_id': planId,
      if (tripId != null) 'trip_id': tripId,
      if (date != null) 'date': date,
      if (originalTitle != null) 'original_title': originalTitle,
      if (title != null) 'title': title,
      if (content != null) 'content': content,
      if (status != null) 'status': status,
      if (actualNote != null) 'actual_note': actualNote,
      if (photoUri != null) 'photo_uri': photoUri,
      if (sortOrder != null) 'sort_order': sortOrder,
      if (createdAt != null) 'created_at': createdAt,
      if (rowid != null) 'rowid': rowid,
    });
  }

  TripDayPlansCompanion copyWith({
    Value<String>? planId,
    Value<String>? tripId,
    Value<DateTime>? date,
    Value<String?>? originalTitle,
    Value<String>? title,
    Value<String?>? content,
    Value<String>? status,
    Value<String?>? actualNote,
    Value<String?>? photoUri,
    Value<int>? sortOrder,
    Value<DateTime>? createdAt,
    Value<int>? rowid,
  }) {
    return TripDayPlansCompanion(
      planId: planId ?? this.planId,
      tripId: tripId ?? this.tripId,
      date: date ?? this.date,
      originalTitle: originalTitle ?? this.originalTitle,
      title: title ?? this.title,
      content: content ?? this.content,
      status: status ?? this.status,
      actualNote: actualNote ?? this.actualNote,
      photoUri: photoUri ?? this.photoUri,
      sortOrder: sortOrder ?? this.sortOrder,
      createdAt: createdAt ?? this.createdAt,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (planId.present) {
      map['plan_id'] = Variable<String>(planId.value);
    }
    if (tripId.present) {
      map['trip_id'] = Variable<String>(tripId.value);
    }
    if (date.present) {
      map['date'] = Variable<DateTime>(date.value);
    }
    if (originalTitle.present) {
      map['original_title'] = Variable<String>(originalTitle.value);
    }
    if (title.present) {
      map['title'] = Variable<String>(title.value);
    }
    if (content.present) {
      map['content'] = Variable<String>(content.value);
    }
    if (status.present) {
      map['status'] = Variable<String>(status.value);
    }
    if (actualNote.present) {
      map['actual_note'] = Variable<String>(actualNote.value);
    }
    if (photoUri.present) {
      map['photo_uri'] = Variable<String>(photoUri.value);
    }
    if (sortOrder.present) {
      map['sort_order'] = Variable<int>(sortOrder.value);
    }
    if (createdAt.present) {
      map['created_at'] = Variable<DateTime>(createdAt.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('TripDayPlansCompanion(')
          ..write('planId: $planId, ')
          ..write('tripId: $tripId, ')
          ..write('date: $date, ')
          ..write('originalTitle: $originalTitle, ')
          ..write('title: $title, ')
          ..write('content: $content, ')
          ..write('status: $status, ')
          ..write('actualNote: $actualNote, ')
          ..write('photoUri: $photoUri, ')
          ..write('sortOrder: $sortOrder, ')
          ..write('createdAt: $createdAt, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $TripChecklistsTable extends TripChecklists
    with TableInfo<$TripChecklistsTable, TripChecklist> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $TripChecklistsTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _checkIdMeta = const VerificationMeta(
    'checkId',
  );
  @override
  late final GeneratedColumn<String> checkId = GeneratedColumn<String>(
    'check_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _tripIdMeta = const VerificationMeta('tripId');
  @override
  late final GeneratedColumn<String> tripId = GeneratedColumn<String>(
    'trip_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _itemMeta = const VerificationMeta('item');
  @override
  late final GeneratedColumn<String> item = GeneratedColumn<String>(
    'item',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _categoryMeta = const VerificationMeta(
    'category',
  );
  @override
  late final GeneratedColumn<String> category = GeneratedColumn<String>(
    'category',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _isDoneMeta = const VerificationMeta('isDone');
  @override
  late final GeneratedColumn<bool> isDone = GeneratedColumn<bool>(
    'is_done',
    aliasedName,
    false,
    type: DriftSqlType.bool,
    requiredDuringInsert: false,
    defaultConstraints: GeneratedColumn.constraintIsAlways(
      'CHECK ("is_done" IN (0, 1))',
    ),
    defaultValue: const Constant(false),
  );
  static const VerificationMeta _sortOrderMeta = const VerificationMeta(
    'sortOrder',
  );
  @override
  late final GeneratedColumn<int> sortOrder = GeneratedColumn<int>(
    'sort_order',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
    defaultValue: const Constant(0),
  );
  static const VerificationMeta _createdAtMeta = const VerificationMeta(
    'createdAt',
  );
  @override
  late final GeneratedColumn<DateTime> createdAt = GeneratedColumn<DateTime>(
    'created_at',
    aliasedName,
    false,
    type: DriftSqlType.dateTime,
    requiredDuringInsert: false,
    defaultValue: currentDateAndTime,
  );
  @override
  List<GeneratedColumn> get $columns => [
    checkId,
    tripId,
    item,
    category,
    isDone,
    sortOrder,
    createdAt,
  ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'trip_checklists';
  @override
  VerificationContext validateIntegrity(
    Insertable<TripChecklist> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('check_id')) {
      context.handle(
        _checkIdMeta,
        checkId.isAcceptableOrUnknown(data['check_id']!, _checkIdMeta),
      );
    } else if (isInserting) {
      context.missing(_checkIdMeta);
    }
    if (data.containsKey('trip_id')) {
      context.handle(
        _tripIdMeta,
        tripId.isAcceptableOrUnknown(data['trip_id']!, _tripIdMeta),
      );
    } else if (isInserting) {
      context.missing(_tripIdMeta);
    }
    if (data.containsKey('item')) {
      context.handle(
        _itemMeta,
        item.isAcceptableOrUnknown(data['item']!, _itemMeta),
      );
    } else if (isInserting) {
      context.missing(_itemMeta);
    }
    if (data.containsKey('category')) {
      context.handle(
        _categoryMeta,
        category.isAcceptableOrUnknown(data['category']!, _categoryMeta),
      );
    }
    if (data.containsKey('is_done')) {
      context.handle(
        _isDoneMeta,
        isDone.isAcceptableOrUnknown(data['is_done']!, _isDoneMeta),
      );
    }
    if (data.containsKey('sort_order')) {
      context.handle(
        _sortOrderMeta,
        sortOrder.isAcceptableOrUnknown(data['sort_order']!, _sortOrderMeta),
      );
    }
    if (data.containsKey('created_at')) {
      context.handle(
        _createdAtMeta,
        createdAt.isAcceptableOrUnknown(data['created_at']!, _createdAtMeta),
      );
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {checkId};
  @override
  TripChecklist map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return TripChecklist(
      checkId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}check_id'],
      )!,
      tripId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}trip_id'],
      )!,
      item: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}item'],
      )!,
      category: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}category'],
      ),
      isDone: attachedDatabase.typeMapping.read(
        DriftSqlType.bool,
        data['${effectivePrefix}is_done'],
      )!,
      sortOrder: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}sort_order'],
      )!,
      createdAt: attachedDatabase.typeMapping.read(
        DriftSqlType.dateTime,
        data['${effectivePrefix}created_at'],
      )!,
    );
  }

  @override
  $TripChecklistsTable createAlias(String alias) {
    return $TripChecklistsTable(attachedDatabase, alias);
  }
}

class TripChecklist extends DataClass implements Insertable<TripChecklist> {
  final String checkId;
  final String tripId;
  final String item;
  final String? category;
  final bool isDone;
  final int sortOrder;
  final DateTime createdAt;
  const TripChecklist({
    required this.checkId,
    required this.tripId,
    required this.item,
    this.category,
    required this.isDone,
    required this.sortOrder,
    required this.createdAt,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['check_id'] = Variable<String>(checkId);
    map['trip_id'] = Variable<String>(tripId);
    map['item'] = Variable<String>(item);
    if (!nullToAbsent || category != null) {
      map['category'] = Variable<String>(category);
    }
    map['is_done'] = Variable<bool>(isDone);
    map['sort_order'] = Variable<int>(sortOrder);
    map['created_at'] = Variable<DateTime>(createdAt);
    return map;
  }

  TripChecklistsCompanion toCompanion(bool nullToAbsent) {
    return TripChecklistsCompanion(
      checkId: Value(checkId),
      tripId: Value(tripId),
      item: Value(item),
      category: category == null && nullToAbsent
          ? const Value.absent()
          : Value(category),
      isDone: Value(isDone),
      sortOrder: Value(sortOrder),
      createdAt: Value(createdAt),
    );
  }

  factory TripChecklist.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return TripChecklist(
      checkId: serializer.fromJson<String>(json['checkId']),
      tripId: serializer.fromJson<String>(json['tripId']),
      item: serializer.fromJson<String>(json['item']),
      category: serializer.fromJson<String?>(json['category']),
      isDone: serializer.fromJson<bool>(json['isDone']),
      sortOrder: serializer.fromJson<int>(json['sortOrder']),
      createdAt: serializer.fromJson<DateTime>(json['createdAt']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'checkId': serializer.toJson<String>(checkId),
      'tripId': serializer.toJson<String>(tripId),
      'item': serializer.toJson<String>(item),
      'category': serializer.toJson<String?>(category),
      'isDone': serializer.toJson<bool>(isDone),
      'sortOrder': serializer.toJson<int>(sortOrder),
      'createdAt': serializer.toJson<DateTime>(createdAt),
    };
  }

  TripChecklist copyWith({
    String? checkId,
    String? tripId,
    String? item,
    Value<String?> category = const Value.absent(),
    bool? isDone,
    int? sortOrder,
    DateTime? createdAt,
  }) => TripChecklist(
    checkId: checkId ?? this.checkId,
    tripId: tripId ?? this.tripId,
    item: item ?? this.item,
    category: category.present ? category.value : this.category,
    isDone: isDone ?? this.isDone,
    sortOrder: sortOrder ?? this.sortOrder,
    createdAt: createdAt ?? this.createdAt,
  );
  TripChecklist copyWithCompanion(TripChecklistsCompanion data) {
    return TripChecklist(
      checkId: data.checkId.present ? data.checkId.value : this.checkId,
      tripId: data.tripId.present ? data.tripId.value : this.tripId,
      item: data.item.present ? data.item.value : this.item,
      category: data.category.present ? data.category.value : this.category,
      isDone: data.isDone.present ? data.isDone.value : this.isDone,
      sortOrder: data.sortOrder.present ? data.sortOrder.value : this.sortOrder,
      createdAt: data.createdAt.present ? data.createdAt.value : this.createdAt,
    );
  }

  @override
  String toString() {
    return (StringBuffer('TripChecklist(')
          ..write('checkId: $checkId, ')
          ..write('tripId: $tripId, ')
          ..write('item: $item, ')
          ..write('category: $category, ')
          ..write('isDone: $isDone, ')
          ..write('sortOrder: $sortOrder, ')
          ..write('createdAt: $createdAt')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(
    checkId,
    tripId,
    item,
    category,
    isDone,
    sortOrder,
    createdAt,
  );
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is TripChecklist &&
          other.checkId == this.checkId &&
          other.tripId == this.tripId &&
          other.item == this.item &&
          other.category == this.category &&
          other.isDone == this.isDone &&
          other.sortOrder == this.sortOrder &&
          other.createdAt == this.createdAt);
}

class TripChecklistsCompanion extends UpdateCompanion<TripChecklist> {
  final Value<String> checkId;
  final Value<String> tripId;
  final Value<String> item;
  final Value<String?> category;
  final Value<bool> isDone;
  final Value<int> sortOrder;
  final Value<DateTime> createdAt;
  final Value<int> rowid;
  const TripChecklistsCompanion({
    this.checkId = const Value.absent(),
    this.tripId = const Value.absent(),
    this.item = const Value.absent(),
    this.category = const Value.absent(),
    this.isDone = const Value.absent(),
    this.sortOrder = const Value.absent(),
    this.createdAt = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  TripChecklistsCompanion.insert({
    required String checkId,
    required String tripId,
    required String item,
    this.category = const Value.absent(),
    this.isDone = const Value.absent(),
    this.sortOrder = const Value.absent(),
    this.createdAt = const Value.absent(),
    this.rowid = const Value.absent(),
  }) : checkId = Value(checkId),
       tripId = Value(tripId),
       item = Value(item);
  static Insertable<TripChecklist> custom({
    Expression<String>? checkId,
    Expression<String>? tripId,
    Expression<String>? item,
    Expression<String>? category,
    Expression<bool>? isDone,
    Expression<int>? sortOrder,
    Expression<DateTime>? createdAt,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (checkId != null) 'check_id': checkId,
      if (tripId != null) 'trip_id': tripId,
      if (item != null) 'item': item,
      if (category != null) 'category': category,
      if (isDone != null) 'is_done': isDone,
      if (sortOrder != null) 'sort_order': sortOrder,
      if (createdAt != null) 'created_at': createdAt,
      if (rowid != null) 'rowid': rowid,
    });
  }

  TripChecklistsCompanion copyWith({
    Value<String>? checkId,
    Value<String>? tripId,
    Value<String>? item,
    Value<String?>? category,
    Value<bool>? isDone,
    Value<int>? sortOrder,
    Value<DateTime>? createdAt,
    Value<int>? rowid,
  }) {
    return TripChecklistsCompanion(
      checkId: checkId ?? this.checkId,
      tripId: tripId ?? this.tripId,
      item: item ?? this.item,
      category: category ?? this.category,
      isDone: isDone ?? this.isDone,
      sortOrder: sortOrder ?? this.sortOrder,
      createdAt: createdAt ?? this.createdAt,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (checkId.present) {
      map['check_id'] = Variable<String>(checkId.value);
    }
    if (tripId.present) {
      map['trip_id'] = Variable<String>(tripId.value);
    }
    if (item.present) {
      map['item'] = Variable<String>(item.value);
    }
    if (category.present) {
      map['category'] = Variable<String>(category.value);
    }
    if (isDone.present) {
      map['is_done'] = Variable<bool>(isDone.value);
    }
    if (sortOrder.present) {
      map['sort_order'] = Variable<int>(sortOrder.value);
    }
    if (createdAt.present) {
      map['created_at'] = Variable<DateTime>(createdAt.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('TripChecklistsCompanion(')
          ..write('checkId: $checkId, ')
          ..write('tripId: $tripId, ')
          ..write('item: $item, ')
          ..write('category: $category, ')
          ..write('isDone: $isDone, ')
          ..write('sortOrder: $sortOrder, ')
          ..write('createdAt: $createdAt, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

abstract class _$AppDatabase extends GeneratedDatabase {
  _$AppDatabase(QueryExecutor e) : super(e);
  $AppDatabaseManager get managers => $AppDatabaseManager(this);
  late final $UsersTable users = $UsersTable(this);
  late final $CalendarEventsTable calendarEvents = $CalendarEventsTable(this);
  late final $MeetingsTable meetings = $MeetingsTable(this);
  late final $TranscriptSegmentsTable transcriptSegments =
      $TranscriptSegmentsTable(this);
  late final $ExtractedItemsTable extractedItems = $ExtractedItemsTable(this);
  late final $MealRecordsTable mealRecords = $MealRecordsTable(this);
  late final $DailyContextsTable dailyContexts = $DailyContextsTable(this);
  late final $MedicationRecordsTable medicationRecords =
      $MedicationRecordsTable(this);
  late final $ExerciseRecordsTable exerciseRecords = $ExerciseRecordsTable(
    this,
  );
  late final $HospitalRecordsTable hospitalRecords = $HospitalRecordsTable(
    this,
  );
  late final $SleepRecordsTable sleepRecords = $SleepRecordsTable(this);
  late final $RoutineItemsTable routineItems = $RoutineItemsTable(this);
  late final $RoutineCompletionsTable routineCompletions =
      $RoutineCompletionsTable(this);
  late final $FashionRecordsTable fashionRecords = $FashionRecordsTable(this);
  late final $PrepareItemsTable prepareItems = $PrepareItemsTable(this);
  late final $SubscriptionItemsTable subscriptionItems =
      $SubscriptionItemsTable(this);
  late final $CaptureItemsTable captureItems = $CaptureItemsTable(this);
  late final $ExtractedCapturesTable extractedCaptures =
      $ExtractedCapturesTable(this);
  late final $TransactionsTable transactions = $TransactionsTable(this);
  late final $MemosTable memos = $MemosTable(this);
  late final $BriefingsTable briefings = $BriefingsTable(this);
  late final $RollingSummariesTable rollingSummaries = $RollingSummariesTable(
    this,
  );
  late final $TripsTable trips = $TripsTable(this);
  late final $TripDayPlansTable tripDayPlans = $TripDayPlansTable(this);
  late final $TripChecklistsTable tripChecklists = $TripChecklistsTable(this);
  @override
  Iterable<TableInfo<Table, Object?>> get allTables =>
      allSchemaEntities.whereType<TableInfo<Table, Object?>>();
  @override
  List<DatabaseSchemaEntity> get allSchemaEntities => [
    users,
    calendarEvents,
    meetings,
    transcriptSegments,
    extractedItems,
    mealRecords,
    dailyContexts,
    medicationRecords,
    exerciseRecords,
    hospitalRecords,
    sleepRecords,
    routineItems,
    routineCompletions,
    fashionRecords,
    prepareItems,
    subscriptionItems,
    captureItems,
    extractedCaptures,
    transactions,
    memos,
    briefings,
    rollingSummaries,
    trips,
    tripDayPlans,
    tripChecklists,
  ];
}

typedef $$UsersTableCreateCompanionBuilder =
    UsersCompanion Function({
      required String userId,
      Value<String> timezone,
      Value<String?> locale,
      Value<String> settingsJson,
      Value<DateTime> createdAt,
      Value<DateTime> updatedAt,
      Value<int> rowid,
    });
typedef $$UsersTableUpdateCompanionBuilder =
    UsersCompanion Function({
      Value<String> userId,
      Value<String> timezone,
      Value<String?> locale,
      Value<String> settingsJson,
      Value<DateTime> createdAt,
      Value<DateTime> updatedAt,
      Value<int> rowid,
    });

class $$UsersTableFilterComposer extends Composer<_$AppDatabase, $UsersTable> {
  $$UsersTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get userId => $composableBuilder(
    column: $table.userId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get timezone => $composableBuilder(
    column: $table.timezone,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get locale => $composableBuilder(
    column: $table.locale,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get settingsJson => $composableBuilder(
    column: $table.settingsJson,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<DateTime> get createdAt => $composableBuilder(
    column: $table.createdAt,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<DateTime> get updatedAt => $composableBuilder(
    column: $table.updatedAt,
    builder: (column) => ColumnFilters(column),
  );
}

class $$UsersTableOrderingComposer
    extends Composer<_$AppDatabase, $UsersTable> {
  $$UsersTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get userId => $composableBuilder(
    column: $table.userId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get timezone => $composableBuilder(
    column: $table.timezone,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get locale => $composableBuilder(
    column: $table.locale,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get settingsJson => $composableBuilder(
    column: $table.settingsJson,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<DateTime> get createdAt => $composableBuilder(
    column: $table.createdAt,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<DateTime> get updatedAt => $composableBuilder(
    column: $table.updatedAt,
    builder: (column) => ColumnOrderings(column),
  );
}

class $$UsersTableAnnotationComposer
    extends Composer<_$AppDatabase, $UsersTable> {
  $$UsersTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get userId =>
      $composableBuilder(column: $table.userId, builder: (column) => column);

  GeneratedColumn<String> get timezone =>
      $composableBuilder(column: $table.timezone, builder: (column) => column);

  GeneratedColumn<String> get locale =>
      $composableBuilder(column: $table.locale, builder: (column) => column);

  GeneratedColumn<String> get settingsJson => $composableBuilder(
    column: $table.settingsJson,
    builder: (column) => column,
  );

  GeneratedColumn<DateTime> get createdAt =>
      $composableBuilder(column: $table.createdAt, builder: (column) => column);

  GeneratedColumn<DateTime> get updatedAt =>
      $composableBuilder(column: $table.updatedAt, builder: (column) => column);
}

class $$UsersTableTableManager
    extends
        RootTableManager<
          _$AppDatabase,
          $UsersTable,
          User,
          $$UsersTableFilterComposer,
          $$UsersTableOrderingComposer,
          $$UsersTableAnnotationComposer,
          $$UsersTableCreateCompanionBuilder,
          $$UsersTableUpdateCompanionBuilder,
          (User, BaseReferences<_$AppDatabase, $UsersTable, User>),
          User,
          PrefetchHooks Function()
        > {
  $$UsersTableTableManager(_$AppDatabase db, $UsersTable table)
    : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$UsersTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$UsersTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$UsersTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback:
              ({
                Value<String> userId = const Value.absent(),
                Value<String> timezone = const Value.absent(),
                Value<String?> locale = const Value.absent(),
                Value<String> settingsJson = const Value.absent(),
                Value<DateTime> createdAt = const Value.absent(),
                Value<DateTime> updatedAt = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => UsersCompanion(
                userId: userId,
                timezone: timezone,
                locale: locale,
                settingsJson: settingsJson,
                createdAt: createdAt,
                updatedAt: updatedAt,
                rowid: rowid,
              ),
          createCompanionCallback:
              ({
                required String userId,
                Value<String> timezone = const Value.absent(),
                Value<String?> locale = const Value.absent(),
                Value<String> settingsJson = const Value.absent(),
                Value<DateTime> createdAt = const Value.absent(),
                Value<DateTime> updatedAt = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => UsersCompanion.insert(
                userId: userId,
                timezone: timezone,
                locale: locale,
                settingsJson: settingsJson,
                createdAt: createdAt,
                updatedAt: updatedAt,
                rowid: rowid,
              ),
          withReferenceMapper: (p0) => p0
              .map((e) => (e.readTable(table), BaseReferences(db, table, e)))
              .toList(),
          prefetchHooksCallback: null,
        ),
      );
}

typedef $$UsersTableProcessedTableManager =
    ProcessedTableManager<
      _$AppDatabase,
      $UsersTable,
      User,
      $$UsersTableFilterComposer,
      $$UsersTableOrderingComposer,
      $$UsersTableAnnotationComposer,
      $$UsersTableCreateCompanionBuilder,
      $$UsersTableUpdateCompanionBuilder,
      (User, BaseReferences<_$AppDatabase, $UsersTable, User>),
      User,
      PrefetchHooks Function()
    >;
typedef $$CalendarEventsTableCreateCompanionBuilder =
    CalendarEventsCompanion Function({
      required String calendarEventId,
      required String userId,
      required String title,
      required DateTime startTime,
      required DateTime endTime,
      Value<String?> location,
      Value<String?> category,
      Value<String> source,
      Value<DateTime> createdAt,
      Value<int> rowid,
    });
typedef $$CalendarEventsTableUpdateCompanionBuilder =
    CalendarEventsCompanion Function({
      Value<String> calendarEventId,
      Value<String> userId,
      Value<String> title,
      Value<DateTime> startTime,
      Value<DateTime> endTime,
      Value<String?> location,
      Value<String?> category,
      Value<String> source,
      Value<DateTime> createdAt,
      Value<int> rowid,
    });

class $$CalendarEventsTableFilterComposer
    extends Composer<_$AppDatabase, $CalendarEventsTable> {
  $$CalendarEventsTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get calendarEventId => $composableBuilder(
    column: $table.calendarEventId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get userId => $composableBuilder(
    column: $table.userId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get title => $composableBuilder(
    column: $table.title,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<DateTime> get startTime => $composableBuilder(
    column: $table.startTime,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<DateTime> get endTime => $composableBuilder(
    column: $table.endTime,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get location => $composableBuilder(
    column: $table.location,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get category => $composableBuilder(
    column: $table.category,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get source => $composableBuilder(
    column: $table.source,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<DateTime> get createdAt => $composableBuilder(
    column: $table.createdAt,
    builder: (column) => ColumnFilters(column),
  );
}

class $$CalendarEventsTableOrderingComposer
    extends Composer<_$AppDatabase, $CalendarEventsTable> {
  $$CalendarEventsTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get calendarEventId => $composableBuilder(
    column: $table.calendarEventId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get userId => $composableBuilder(
    column: $table.userId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get title => $composableBuilder(
    column: $table.title,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<DateTime> get startTime => $composableBuilder(
    column: $table.startTime,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<DateTime> get endTime => $composableBuilder(
    column: $table.endTime,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get location => $composableBuilder(
    column: $table.location,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get category => $composableBuilder(
    column: $table.category,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get source => $composableBuilder(
    column: $table.source,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<DateTime> get createdAt => $composableBuilder(
    column: $table.createdAt,
    builder: (column) => ColumnOrderings(column),
  );
}

class $$CalendarEventsTableAnnotationComposer
    extends Composer<_$AppDatabase, $CalendarEventsTable> {
  $$CalendarEventsTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get calendarEventId => $composableBuilder(
    column: $table.calendarEventId,
    builder: (column) => column,
  );

  GeneratedColumn<String> get userId =>
      $composableBuilder(column: $table.userId, builder: (column) => column);

  GeneratedColumn<String> get title =>
      $composableBuilder(column: $table.title, builder: (column) => column);

  GeneratedColumn<DateTime> get startTime =>
      $composableBuilder(column: $table.startTime, builder: (column) => column);

  GeneratedColumn<DateTime> get endTime =>
      $composableBuilder(column: $table.endTime, builder: (column) => column);

  GeneratedColumn<String> get location =>
      $composableBuilder(column: $table.location, builder: (column) => column);

  GeneratedColumn<String> get category =>
      $composableBuilder(column: $table.category, builder: (column) => column);

  GeneratedColumn<String> get source =>
      $composableBuilder(column: $table.source, builder: (column) => column);

  GeneratedColumn<DateTime> get createdAt =>
      $composableBuilder(column: $table.createdAt, builder: (column) => column);
}

class $$CalendarEventsTableTableManager
    extends
        RootTableManager<
          _$AppDatabase,
          $CalendarEventsTable,
          CalendarEvent,
          $$CalendarEventsTableFilterComposer,
          $$CalendarEventsTableOrderingComposer,
          $$CalendarEventsTableAnnotationComposer,
          $$CalendarEventsTableCreateCompanionBuilder,
          $$CalendarEventsTableUpdateCompanionBuilder,
          (
            CalendarEvent,
            BaseReferences<_$AppDatabase, $CalendarEventsTable, CalendarEvent>,
          ),
          CalendarEvent,
          PrefetchHooks Function()
        > {
  $$CalendarEventsTableTableManager(
    _$AppDatabase db,
    $CalendarEventsTable table,
  ) : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$CalendarEventsTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$CalendarEventsTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$CalendarEventsTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback:
              ({
                Value<String> calendarEventId = const Value.absent(),
                Value<String> userId = const Value.absent(),
                Value<String> title = const Value.absent(),
                Value<DateTime> startTime = const Value.absent(),
                Value<DateTime> endTime = const Value.absent(),
                Value<String?> location = const Value.absent(),
                Value<String?> category = const Value.absent(),
                Value<String> source = const Value.absent(),
                Value<DateTime> createdAt = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => CalendarEventsCompanion(
                calendarEventId: calendarEventId,
                userId: userId,
                title: title,
                startTime: startTime,
                endTime: endTime,
                location: location,
                category: category,
                source: source,
                createdAt: createdAt,
                rowid: rowid,
              ),
          createCompanionCallback:
              ({
                required String calendarEventId,
                required String userId,
                required String title,
                required DateTime startTime,
                required DateTime endTime,
                Value<String?> location = const Value.absent(),
                Value<String?> category = const Value.absent(),
                Value<String> source = const Value.absent(),
                Value<DateTime> createdAt = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => CalendarEventsCompanion.insert(
                calendarEventId: calendarEventId,
                userId: userId,
                title: title,
                startTime: startTime,
                endTime: endTime,
                location: location,
                category: category,
                source: source,
                createdAt: createdAt,
                rowid: rowid,
              ),
          withReferenceMapper: (p0) => p0
              .map((e) => (e.readTable(table), BaseReferences(db, table, e)))
              .toList(),
          prefetchHooksCallback: null,
        ),
      );
}

typedef $$CalendarEventsTableProcessedTableManager =
    ProcessedTableManager<
      _$AppDatabase,
      $CalendarEventsTable,
      CalendarEvent,
      $$CalendarEventsTableFilterComposer,
      $$CalendarEventsTableOrderingComposer,
      $$CalendarEventsTableAnnotationComposer,
      $$CalendarEventsTableCreateCompanionBuilder,
      $$CalendarEventsTableUpdateCompanionBuilder,
      (
        CalendarEvent,
        BaseReferences<_$AppDatabase, $CalendarEventsTable, CalendarEvent>,
      ),
      CalendarEvent,
      PrefetchHooks Function()
    >;
typedef $$MeetingsTableCreateCompanionBuilder =
    MeetingsCompanion Function({
      required String meetingId,
      Value<String?> calendarEventId,
      Value<String> title,
      Value<String> status,
      Value<String> recordType,
      Value<String?> participantName,
      Value<DateTime?> startedAt,
      Value<DateTime?> endedAt,
      Value<String?> summary,
      Value<int> segmentCount,
      Value<int> actionCount,
      Value<int> decisionCount,
      Value<bool> isImportant,
      Value<DateTime> createdAt,
      Value<DateTime> updatedAt,
      Value<int> rowid,
    });
typedef $$MeetingsTableUpdateCompanionBuilder =
    MeetingsCompanion Function({
      Value<String> meetingId,
      Value<String?> calendarEventId,
      Value<String> title,
      Value<String> status,
      Value<String> recordType,
      Value<String?> participantName,
      Value<DateTime?> startedAt,
      Value<DateTime?> endedAt,
      Value<String?> summary,
      Value<int> segmentCount,
      Value<int> actionCount,
      Value<int> decisionCount,
      Value<bool> isImportant,
      Value<DateTime> createdAt,
      Value<DateTime> updatedAt,
      Value<int> rowid,
    });

class $$MeetingsTableFilterComposer
    extends Composer<_$AppDatabase, $MeetingsTable> {
  $$MeetingsTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get meetingId => $composableBuilder(
    column: $table.meetingId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get calendarEventId => $composableBuilder(
    column: $table.calendarEventId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get title => $composableBuilder(
    column: $table.title,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get status => $composableBuilder(
    column: $table.status,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get recordType => $composableBuilder(
    column: $table.recordType,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get participantName => $composableBuilder(
    column: $table.participantName,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<DateTime> get startedAt => $composableBuilder(
    column: $table.startedAt,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<DateTime> get endedAt => $composableBuilder(
    column: $table.endedAt,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get summary => $composableBuilder(
    column: $table.summary,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get segmentCount => $composableBuilder(
    column: $table.segmentCount,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get actionCount => $composableBuilder(
    column: $table.actionCount,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get decisionCount => $composableBuilder(
    column: $table.decisionCount,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<bool> get isImportant => $composableBuilder(
    column: $table.isImportant,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<DateTime> get createdAt => $composableBuilder(
    column: $table.createdAt,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<DateTime> get updatedAt => $composableBuilder(
    column: $table.updatedAt,
    builder: (column) => ColumnFilters(column),
  );
}

class $$MeetingsTableOrderingComposer
    extends Composer<_$AppDatabase, $MeetingsTable> {
  $$MeetingsTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get meetingId => $composableBuilder(
    column: $table.meetingId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get calendarEventId => $composableBuilder(
    column: $table.calendarEventId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get title => $composableBuilder(
    column: $table.title,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get status => $composableBuilder(
    column: $table.status,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get recordType => $composableBuilder(
    column: $table.recordType,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get participantName => $composableBuilder(
    column: $table.participantName,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<DateTime> get startedAt => $composableBuilder(
    column: $table.startedAt,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<DateTime> get endedAt => $composableBuilder(
    column: $table.endedAt,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get summary => $composableBuilder(
    column: $table.summary,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get segmentCount => $composableBuilder(
    column: $table.segmentCount,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get actionCount => $composableBuilder(
    column: $table.actionCount,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get decisionCount => $composableBuilder(
    column: $table.decisionCount,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<bool> get isImportant => $composableBuilder(
    column: $table.isImportant,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<DateTime> get createdAt => $composableBuilder(
    column: $table.createdAt,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<DateTime> get updatedAt => $composableBuilder(
    column: $table.updatedAt,
    builder: (column) => ColumnOrderings(column),
  );
}

class $$MeetingsTableAnnotationComposer
    extends Composer<_$AppDatabase, $MeetingsTable> {
  $$MeetingsTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get meetingId =>
      $composableBuilder(column: $table.meetingId, builder: (column) => column);

  GeneratedColumn<String> get calendarEventId => $composableBuilder(
    column: $table.calendarEventId,
    builder: (column) => column,
  );

  GeneratedColumn<String> get title =>
      $composableBuilder(column: $table.title, builder: (column) => column);

  GeneratedColumn<String> get status =>
      $composableBuilder(column: $table.status, builder: (column) => column);

  GeneratedColumn<String> get recordType => $composableBuilder(
    column: $table.recordType,
    builder: (column) => column,
  );

  GeneratedColumn<String> get participantName => $composableBuilder(
    column: $table.participantName,
    builder: (column) => column,
  );

  GeneratedColumn<DateTime> get startedAt =>
      $composableBuilder(column: $table.startedAt, builder: (column) => column);

  GeneratedColumn<DateTime> get endedAt =>
      $composableBuilder(column: $table.endedAt, builder: (column) => column);

  GeneratedColumn<String> get summary =>
      $composableBuilder(column: $table.summary, builder: (column) => column);

  GeneratedColumn<int> get segmentCount => $composableBuilder(
    column: $table.segmentCount,
    builder: (column) => column,
  );

  GeneratedColumn<int> get actionCount => $composableBuilder(
    column: $table.actionCount,
    builder: (column) => column,
  );

  GeneratedColumn<int> get decisionCount => $composableBuilder(
    column: $table.decisionCount,
    builder: (column) => column,
  );

  GeneratedColumn<bool> get isImportant => $composableBuilder(
    column: $table.isImportant,
    builder: (column) => column,
  );

  GeneratedColumn<DateTime> get createdAt =>
      $composableBuilder(column: $table.createdAt, builder: (column) => column);

  GeneratedColumn<DateTime> get updatedAt =>
      $composableBuilder(column: $table.updatedAt, builder: (column) => column);
}

class $$MeetingsTableTableManager
    extends
        RootTableManager<
          _$AppDatabase,
          $MeetingsTable,
          Meeting,
          $$MeetingsTableFilterComposer,
          $$MeetingsTableOrderingComposer,
          $$MeetingsTableAnnotationComposer,
          $$MeetingsTableCreateCompanionBuilder,
          $$MeetingsTableUpdateCompanionBuilder,
          (Meeting, BaseReferences<_$AppDatabase, $MeetingsTable, Meeting>),
          Meeting,
          PrefetchHooks Function()
        > {
  $$MeetingsTableTableManager(_$AppDatabase db, $MeetingsTable table)
    : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$MeetingsTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$MeetingsTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$MeetingsTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback:
              ({
                Value<String> meetingId = const Value.absent(),
                Value<String?> calendarEventId = const Value.absent(),
                Value<String> title = const Value.absent(),
                Value<String> status = const Value.absent(),
                Value<String> recordType = const Value.absent(),
                Value<String?> participantName = const Value.absent(),
                Value<DateTime?> startedAt = const Value.absent(),
                Value<DateTime?> endedAt = const Value.absent(),
                Value<String?> summary = const Value.absent(),
                Value<int> segmentCount = const Value.absent(),
                Value<int> actionCount = const Value.absent(),
                Value<int> decisionCount = const Value.absent(),
                Value<bool> isImportant = const Value.absent(),
                Value<DateTime> createdAt = const Value.absent(),
                Value<DateTime> updatedAt = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => MeetingsCompanion(
                meetingId: meetingId,
                calendarEventId: calendarEventId,
                title: title,
                status: status,
                recordType: recordType,
                participantName: participantName,
                startedAt: startedAt,
                endedAt: endedAt,
                summary: summary,
                segmentCount: segmentCount,
                actionCount: actionCount,
                decisionCount: decisionCount,
                isImportant: isImportant,
                createdAt: createdAt,
                updatedAt: updatedAt,
                rowid: rowid,
              ),
          createCompanionCallback:
              ({
                required String meetingId,
                Value<String?> calendarEventId = const Value.absent(),
                Value<String> title = const Value.absent(),
                Value<String> status = const Value.absent(),
                Value<String> recordType = const Value.absent(),
                Value<String?> participantName = const Value.absent(),
                Value<DateTime?> startedAt = const Value.absent(),
                Value<DateTime?> endedAt = const Value.absent(),
                Value<String?> summary = const Value.absent(),
                Value<int> segmentCount = const Value.absent(),
                Value<int> actionCount = const Value.absent(),
                Value<int> decisionCount = const Value.absent(),
                Value<bool> isImportant = const Value.absent(),
                Value<DateTime> createdAt = const Value.absent(),
                Value<DateTime> updatedAt = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => MeetingsCompanion.insert(
                meetingId: meetingId,
                calendarEventId: calendarEventId,
                title: title,
                status: status,
                recordType: recordType,
                participantName: participantName,
                startedAt: startedAt,
                endedAt: endedAt,
                summary: summary,
                segmentCount: segmentCount,
                actionCount: actionCount,
                decisionCount: decisionCount,
                isImportant: isImportant,
                createdAt: createdAt,
                updatedAt: updatedAt,
                rowid: rowid,
              ),
          withReferenceMapper: (p0) => p0
              .map((e) => (e.readTable(table), BaseReferences(db, table, e)))
              .toList(),
          prefetchHooksCallback: null,
        ),
      );
}

typedef $$MeetingsTableProcessedTableManager =
    ProcessedTableManager<
      _$AppDatabase,
      $MeetingsTable,
      Meeting,
      $$MeetingsTableFilterComposer,
      $$MeetingsTableOrderingComposer,
      $$MeetingsTableAnnotationComposer,
      $$MeetingsTableCreateCompanionBuilder,
      $$MeetingsTableUpdateCompanionBuilder,
      (Meeting, BaseReferences<_$AppDatabase, $MeetingsTable, Meeting>),
      Meeting,
      PrefetchHooks Function()
    >;
typedef $$TranscriptSegmentsTableCreateCompanionBuilder =
    TranscriptSegmentsCompanion Function({
      required String segmentId,
      required String meetingId,
      Value<String> speaker,
      Value<DateTime?> timestamp,
      required String content,
      Value<double?> confidence,
      Value<String> source,
      Value<DateTime> createdAt,
      Value<int> rowid,
    });
typedef $$TranscriptSegmentsTableUpdateCompanionBuilder =
    TranscriptSegmentsCompanion Function({
      Value<String> segmentId,
      Value<String> meetingId,
      Value<String> speaker,
      Value<DateTime?> timestamp,
      Value<String> content,
      Value<double?> confidence,
      Value<String> source,
      Value<DateTime> createdAt,
      Value<int> rowid,
    });

class $$TranscriptSegmentsTableFilterComposer
    extends Composer<_$AppDatabase, $TranscriptSegmentsTable> {
  $$TranscriptSegmentsTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get segmentId => $composableBuilder(
    column: $table.segmentId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get meetingId => $composableBuilder(
    column: $table.meetingId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get speaker => $composableBuilder(
    column: $table.speaker,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<DateTime> get timestamp => $composableBuilder(
    column: $table.timestamp,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get content => $composableBuilder(
    column: $table.content,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<double> get confidence => $composableBuilder(
    column: $table.confidence,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get source => $composableBuilder(
    column: $table.source,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<DateTime> get createdAt => $composableBuilder(
    column: $table.createdAt,
    builder: (column) => ColumnFilters(column),
  );
}

class $$TranscriptSegmentsTableOrderingComposer
    extends Composer<_$AppDatabase, $TranscriptSegmentsTable> {
  $$TranscriptSegmentsTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get segmentId => $composableBuilder(
    column: $table.segmentId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get meetingId => $composableBuilder(
    column: $table.meetingId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get speaker => $composableBuilder(
    column: $table.speaker,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<DateTime> get timestamp => $composableBuilder(
    column: $table.timestamp,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get content => $composableBuilder(
    column: $table.content,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<double> get confidence => $composableBuilder(
    column: $table.confidence,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get source => $composableBuilder(
    column: $table.source,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<DateTime> get createdAt => $composableBuilder(
    column: $table.createdAt,
    builder: (column) => ColumnOrderings(column),
  );
}

class $$TranscriptSegmentsTableAnnotationComposer
    extends Composer<_$AppDatabase, $TranscriptSegmentsTable> {
  $$TranscriptSegmentsTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get segmentId =>
      $composableBuilder(column: $table.segmentId, builder: (column) => column);

  GeneratedColumn<String> get meetingId =>
      $composableBuilder(column: $table.meetingId, builder: (column) => column);

  GeneratedColumn<String> get speaker =>
      $composableBuilder(column: $table.speaker, builder: (column) => column);

  GeneratedColumn<DateTime> get timestamp =>
      $composableBuilder(column: $table.timestamp, builder: (column) => column);

  GeneratedColumn<String> get content =>
      $composableBuilder(column: $table.content, builder: (column) => column);

  GeneratedColumn<double> get confidence => $composableBuilder(
    column: $table.confidence,
    builder: (column) => column,
  );

  GeneratedColumn<String> get source =>
      $composableBuilder(column: $table.source, builder: (column) => column);

  GeneratedColumn<DateTime> get createdAt =>
      $composableBuilder(column: $table.createdAt, builder: (column) => column);
}

class $$TranscriptSegmentsTableTableManager
    extends
        RootTableManager<
          _$AppDatabase,
          $TranscriptSegmentsTable,
          TranscriptSegment,
          $$TranscriptSegmentsTableFilterComposer,
          $$TranscriptSegmentsTableOrderingComposer,
          $$TranscriptSegmentsTableAnnotationComposer,
          $$TranscriptSegmentsTableCreateCompanionBuilder,
          $$TranscriptSegmentsTableUpdateCompanionBuilder,
          (
            TranscriptSegment,
            BaseReferences<
              _$AppDatabase,
              $TranscriptSegmentsTable,
              TranscriptSegment
            >,
          ),
          TranscriptSegment,
          PrefetchHooks Function()
        > {
  $$TranscriptSegmentsTableTableManager(
    _$AppDatabase db,
    $TranscriptSegmentsTable table,
  ) : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$TranscriptSegmentsTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$TranscriptSegmentsTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$TranscriptSegmentsTableAnnotationComposer(
                $db: db,
                $table: table,
              ),
          updateCompanionCallback:
              ({
                Value<String> segmentId = const Value.absent(),
                Value<String> meetingId = const Value.absent(),
                Value<String> speaker = const Value.absent(),
                Value<DateTime?> timestamp = const Value.absent(),
                Value<String> content = const Value.absent(),
                Value<double?> confidence = const Value.absent(),
                Value<String> source = const Value.absent(),
                Value<DateTime> createdAt = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => TranscriptSegmentsCompanion(
                segmentId: segmentId,
                meetingId: meetingId,
                speaker: speaker,
                timestamp: timestamp,
                content: content,
                confidence: confidence,
                source: source,
                createdAt: createdAt,
                rowid: rowid,
              ),
          createCompanionCallback:
              ({
                required String segmentId,
                required String meetingId,
                Value<String> speaker = const Value.absent(),
                Value<DateTime?> timestamp = const Value.absent(),
                required String content,
                Value<double?> confidence = const Value.absent(),
                Value<String> source = const Value.absent(),
                Value<DateTime> createdAt = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => TranscriptSegmentsCompanion.insert(
                segmentId: segmentId,
                meetingId: meetingId,
                speaker: speaker,
                timestamp: timestamp,
                content: content,
                confidence: confidence,
                source: source,
                createdAt: createdAt,
                rowid: rowid,
              ),
          withReferenceMapper: (p0) => p0
              .map((e) => (e.readTable(table), BaseReferences(db, table, e)))
              .toList(),
          prefetchHooksCallback: null,
        ),
      );
}

typedef $$TranscriptSegmentsTableProcessedTableManager =
    ProcessedTableManager<
      _$AppDatabase,
      $TranscriptSegmentsTable,
      TranscriptSegment,
      $$TranscriptSegmentsTableFilterComposer,
      $$TranscriptSegmentsTableOrderingComposer,
      $$TranscriptSegmentsTableAnnotationComposer,
      $$TranscriptSegmentsTableCreateCompanionBuilder,
      $$TranscriptSegmentsTableUpdateCompanionBuilder,
      (
        TranscriptSegment,
        BaseReferences<
          _$AppDatabase,
          $TranscriptSegmentsTable,
          TranscriptSegment
        >,
      ),
      TranscriptSegment,
      PrefetchHooks Function()
    >;
typedef $$ExtractedItemsTableCreateCompanionBuilder =
    ExtractedItemsCompanion Function({
      required String itemId,
      required String meetingId,
      required String itemType,
      Value<String> status,
      required String content,
      Value<double?> confidence,
      Value<String?> ownerLabel,
      Value<String?> dueDate,
      Value<String?> dueTime,
      Value<String?> scheduledCalendarEventId,
      Value<DateTime?> confirmedAt,
      Value<DateTime?> scheduledAt,
      Value<DateTime?> completedAt,
      Value<DateTime?> archivedAt,
      Value<DateTime> createdAt,
      Value<DateTime> updatedAt,
      Value<int> rowid,
    });
typedef $$ExtractedItemsTableUpdateCompanionBuilder =
    ExtractedItemsCompanion Function({
      Value<String> itemId,
      Value<String> meetingId,
      Value<String> itemType,
      Value<String> status,
      Value<String> content,
      Value<double?> confidence,
      Value<String?> ownerLabel,
      Value<String?> dueDate,
      Value<String?> dueTime,
      Value<String?> scheduledCalendarEventId,
      Value<DateTime?> confirmedAt,
      Value<DateTime?> scheduledAt,
      Value<DateTime?> completedAt,
      Value<DateTime?> archivedAt,
      Value<DateTime> createdAt,
      Value<DateTime> updatedAt,
      Value<int> rowid,
    });

class $$ExtractedItemsTableFilterComposer
    extends Composer<_$AppDatabase, $ExtractedItemsTable> {
  $$ExtractedItemsTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get itemId => $composableBuilder(
    column: $table.itemId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get meetingId => $composableBuilder(
    column: $table.meetingId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get itemType => $composableBuilder(
    column: $table.itemType,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get status => $composableBuilder(
    column: $table.status,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get content => $composableBuilder(
    column: $table.content,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<double> get confidence => $composableBuilder(
    column: $table.confidence,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get ownerLabel => $composableBuilder(
    column: $table.ownerLabel,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get dueDate => $composableBuilder(
    column: $table.dueDate,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get dueTime => $composableBuilder(
    column: $table.dueTime,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get scheduledCalendarEventId => $composableBuilder(
    column: $table.scheduledCalendarEventId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<DateTime> get confirmedAt => $composableBuilder(
    column: $table.confirmedAt,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<DateTime> get scheduledAt => $composableBuilder(
    column: $table.scheduledAt,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<DateTime> get completedAt => $composableBuilder(
    column: $table.completedAt,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<DateTime> get archivedAt => $composableBuilder(
    column: $table.archivedAt,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<DateTime> get createdAt => $composableBuilder(
    column: $table.createdAt,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<DateTime> get updatedAt => $composableBuilder(
    column: $table.updatedAt,
    builder: (column) => ColumnFilters(column),
  );
}

class $$ExtractedItemsTableOrderingComposer
    extends Composer<_$AppDatabase, $ExtractedItemsTable> {
  $$ExtractedItemsTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get itemId => $composableBuilder(
    column: $table.itemId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get meetingId => $composableBuilder(
    column: $table.meetingId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get itemType => $composableBuilder(
    column: $table.itemType,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get status => $composableBuilder(
    column: $table.status,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get content => $composableBuilder(
    column: $table.content,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<double> get confidence => $composableBuilder(
    column: $table.confidence,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get ownerLabel => $composableBuilder(
    column: $table.ownerLabel,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get dueDate => $composableBuilder(
    column: $table.dueDate,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get dueTime => $composableBuilder(
    column: $table.dueTime,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get scheduledCalendarEventId => $composableBuilder(
    column: $table.scheduledCalendarEventId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<DateTime> get confirmedAt => $composableBuilder(
    column: $table.confirmedAt,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<DateTime> get scheduledAt => $composableBuilder(
    column: $table.scheduledAt,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<DateTime> get completedAt => $composableBuilder(
    column: $table.completedAt,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<DateTime> get archivedAt => $composableBuilder(
    column: $table.archivedAt,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<DateTime> get createdAt => $composableBuilder(
    column: $table.createdAt,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<DateTime> get updatedAt => $composableBuilder(
    column: $table.updatedAt,
    builder: (column) => ColumnOrderings(column),
  );
}

class $$ExtractedItemsTableAnnotationComposer
    extends Composer<_$AppDatabase, $ExtractedItemsTable> {
  $$ExtractedItemsTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get itemId =>
      $composableBuilder(column: $table.itemId, builder: (column) => column);

  GeneratedColumn<String> get meetingId =>
      $composableBuilder(column: $table.meetingId, builder: (column) => column);

  GeneratedColumn<String> get itemType =>
      $composableBuilder(column: $table.itemType, builder: (column) => column);

  GeneratedColumn<String> get status =>
      $composableBuilder(column: $table.status, builder: (column) => column);

  GeneratedColumn<String> get content =>
      $composableBuilder(column: $table.content, builder: (column) => column);

  GeneratedColumn<double> get confidence => $composableBuilder(
    column: $table.confidence,
    builder: (column) => column,
  );

  GeneratedColumn<String> get ownerLabel => $composableBuilder(
    column: $table.ownerLabel,
    builder: (column) => column,
  );

  GeneratedColumn<String> get dueDate =>
      $composableBuilder(column: $table.dueDate, builder: (column) => column);

  GeneratedColumn<String> get dueTime =>
      $composableBuilder(column: $table.dueTime, builder: (column) => column);

  GeneratedColumn<String> get scheduledCalendarEventId => $composableBuilder(
    column: $table.scheduledCalendarEventId,
    builder: (column) => column,
  );

  GeneratedColumn<DateTime> get confirmedAt => $composableBuilder(
    column: $table.confirmedAt,
    builder: (column) => column,
  );

  GeneratedColumn<DateTime> get scheduledAt => $composableBuilder(
    column: $table.scheduledAt,
    builder: (column) => column,
  );

  GeneratedColumn<DateTime> get completedAt => $composableBuilder(
    column: $table.completedAt,
    builder: (column) => column,
  );

  GeneratedColumn<DateTime> get archivedAt => $composableBuilder(
    column: $table.archivedAt,
    builder: (column) => column,
  );

  GeneratedColumn<DateTime> get createdAt =>
      $composableBuilder(column: $table.createdAt, builder: (column) => column);

  GeneratedColumn<DateTime> get updatedAt =>
      $composableBuilder(column: $table.updatedAt, builder: (column) => column);
}

class $$ExtractedItemsTableTableManager
    extends
        RootTableManager<
          _$AppDatabase,
          $ExtractedItemsTable,
          ExtractedItem,
          $$ExtractedItemsTableFilterComposer,
          $$ExtractedItemsTableOrderingComposer,
          $$ExtractedItemsTableAnnotationComposer,
          $$ExtractedItemsTableCreateCompanionBuilder,
          $$ExtractedItemsTableUpdateCompanionBuilder,
          (
            ExtractedItem,
            BaseReferences<_$AppDatabase, $ExtractedItemsTable, ExtractedItem>,
          ),
          ExtractedItem,
          PrefetchHooks Function()
        > {
  $$ExtractedItemsTableTableManager(
    _$AppDatabase db,
    $ExtractedItemsTable table,
  ) : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$ExtractedItemsTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$ExtractedItemsTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$ExtractedItemsTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback:
              ({
                Value<String> itemId = const Value.absent(),
                Value<String> meetingId = const Value.absent(),
                Value<String> itemType = const Value.absent(),
                Value<String> status = const Value.absent(),
                Value<String> content = const Value.absent(),
                Value<double?> confidence = const Value.absent(),
                Value<String?> ownerLabel = const Value.absent(),
                Value<String?> dueDate = const Value.absent(),
                Value<String?> dueTime = const Value.absent(),
                Value<String?> scheduledCalendarEventId = const Value.absent(),
                Value<DateTime?> confirmedAt = const Value.absent(),
                Value<DateTime?> scheduledAt = const Value.absent(),
                Value<DateTime?> completedAt = const Value.absent(),
                Value<DateTime?> archivedAt = const Value.absent(),
                Value<DateTime> createdAt = const Value.absent(),
                Value<DateTime> updatedAt = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => ExtractedItemsCompanion(
                itemId: itemId,
                meetingId: meetingId,
                itemType: itemType,
                status: status,
                content: content,
                confidence: confidence,
                ownerLabel: ownerLabel,
                dueDate: dueDate,
                dueTime: dueTime,
                scheduledCalendarEventId: scheduledCalendarEventId,
                confirmedAt: confirmedAt,
                scheduledAt: scheduledAt,
                completedAt: completedAt,
                archivedAt: archivedAt,
                createdAt: createdAt,
                updatedAt: updatedAt,
                rowid: rowid,
              ),
          createCompanionCallback:
              ({
                required String itemId,
                required String meetingId,
                required String itemType,
                Value<String> status = const Value.absent(),
                required String content,
                Value<double?> confidence = const Value.absent(),
                Value<String?> ownerLabel = const Value.absent(),
                Value<String?> dueDate = const Value.absent(),
                Value<String?> dueTime = const Value.absent(),
                Value<String?> scheduledCalendarEventId = const Value.absent(),
                Value<DateTime?> confirmedAt = const Value.absent(),
                Value<DateTime?> scheduledAt = const Value.absent(),
                Value<DateTime?> completedAt = const Value.absent(),
                Value<DateTime?> archivedAt = const Value.absent(),
                Value<DateTime> createdAt = const Value.absent(),
                Value<DateTime> updatedAt = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => ExtractedItemsCompanion.insert(
                itemId: itemId,
                meetingId: meetingId,
                itemType: itemType,
                status: status,
                content: content,
                confidence: confidence,
                ownerLabel: ownerLabel,
                dueDate: dueDate,
                dueTime: dueTime,
                scheduledCalendarEventId: scheduledCalendarEventId,
                confirmedAt: confirmedAt,
                scheduledAt: scheduledAt,
                completedAt: completedAt,
                archivedAt: archivedAt,
                createdAt: createdAt,
                updatedAt: updatedAt,
                rowid: rowid,
              ),
          withReferenceMapper: (p0) => p0
              .map((e) => (e.readTable(table), BaseReferences(db, table, e)))
              .toList(),
          prefetchHooksCallback: null,
        ),
      );
}

typedef $$ExtractedItemsTableProcessedTableManager =
    ProcessedTableManager<
      _$AppDatabase,
      $ExtractedItemsTable,
      ExtractedItem,
      $$ExtractedItemsTableFilterComposer,
      $$ExtractedItemsTableOrderingComposer,
      $$ExtractedItemsTableAnnotationComposer,
      $$ExtractedItemsTableCreateCompanionBuilder,
      $$ExtractedItemsTableUpdateCompanionBuilder,
      (
        ExtractedItem,
        BaseReferences<_$AppDatabase, $ExtractedItemsTable, ExtractedItem>,
      ),
      ExtractedItem,
      PrefetchHooks Function()
    >;
typedef $$MealRecordsTableCreateCompanionBuilder =
    MealRecordsCompanion Function({
      required String mealId,
      required String userId,
      Value<DateTime> eatenAt,
      Value<String?> mealType,
      Value<String?> photoPath,
      Value<String?> description,
      Value<String?> locationLabel,
      Value<double?> locationLat,
      Value<double?> locationLng,
      Value<int?> amount,
      Value<bool> isAmountEstimated,
      Value<String?> extractedId,
      Value<String?> nutritionAnalysisJson,
      Value<DateTime?> nutritionAnalyzedAt,
      Value<DateTime> createdAt,
      Value<int> rowid,
    });
typedef $$MealRecordsTableUpdateCompanionBuilder =
    MealRecordsCompanion Function({
      Value<String> mealId,
      Value<String> userId,
      Value<DateTime> eatenAt,
      Value<String?> mealType,
      Value<String?> photoPath,
      Value<String?> description,
      Value<String?> locationLabel,
      Value<double?> locationLat,
      Value<double?> locationLng,
      Value<int?> amount,
      Value<bool> isAmountEstimated,
      Value<String?> extractedId,
      Value<String?> nutritionAnalysisJson,
      Value<DateTime?> nutritionAnalyzedAt,
      Value<DateTime> createdAt,
      Value<int> rowid,
    });

class $$MealRecordsTableFilterComposer
    extends Composer<_$AppDatabase, $MealRecordsTable> {
  $$MealRecordsTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get mealId => $composableBuilder(
    column: $table.mealId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get userId => $composableBuilder(
    column: $table.userId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<DateTime> get eatenAt => $composableBuilder(
    column: $table.eatenAt,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get mealType => $composableBuilder(
    column: $table.mealType,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get photoPath => $composableBuilder(
    column: $table.photoPath,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get description => $composableBuilder(
    column: $table.description,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get locationLabel => $composableBuilder(
    column: $table.locationLabel,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<double> get locationLat => $composableBuilder(
    column: $table.locationLat,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<double> get locationLng => $composableBuilder(
    column: $table.locationLng,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get amount => $composableBuilder(
    column: $table.amount,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<bool> get isAmountEstimated => $composableBuilder(
    column: $table.isAmountEstimated,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get extractedId => $composableBuilder(
    column: $table.extractedId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get nutritionAnalysisJson => $composableBuilder(
    column: $table.nutritionAnalysisJson,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<DateTime> get nutritionAnalyzedAt => $composableBuilder(
    column: $table.nutritionAnalyzedAt,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<DateTime> get createdAt => $composableBuilder(
    column: $table.createdAt,
    builder: (column) => ColumnFilters(column),
  );
}

class $$MealRecordsTableOrderingComposer
    extends Composer<_$AppDatabase, $MealRecordsTable> {
  $$MealRecordsTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get mealId => $composableBuilder(
    column: $table.mealId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get userId => $composableBuilder(
    column: $table.userId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<DateTime> get eatenAt => $composableBuilder(
    column: $table.eatenAt,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get mealType => $composableBuilder(
    column: $table.mealType,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get photoPath => $composableBuilder(
    column: $table.photoPath,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get description => $composableBuilder(
    column: $table.description,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get locationLabel => $composableBuilder(
    column: $table.locationLabel,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<double> get locationLat => $composableBuilder(
    column: $table.locationLat,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<double> get locationLng => $composableBuilder(
    column: $table.locationLng,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get amount => $composableBuilder(
    column: $table.amount,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<bool> get isAmountEstimated => $composableBuilder(
    column: $table.isAmountEstimated,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get extractedId => $composableBuilder(
    column: $table.extractedId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get nutritionAnalysisJson => $composableBuilder(
    column: $table.nutritionAnalysisJson,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<DateTime> get nutritionAnalyzedAt => $composableBuilder(
    column: $table.nutritionAnalyzedAt,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<DateTime> get createdAt => $composableBuilder(
    column: $table.createdAt,
    builder: (column) => ColumnOrderings(column),
  );
}

class $$MealRecordsTableAnnotationComposer
    extends Composer<_$AppDatabase, $MealRecordsTable> {
  $$MealRecordsTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get mealId =>
      $composableBuilder(column: $table.mealId, builder: (column) => column);

  GeneratedColumn<String> get userId =>
      $composableBuilder(column: $table.userId, builder: (column) => column);

  GeneratedColumn<DateTime> get eatenAt =>
      $composableBuilder(column: $table.eatenAt, builder: (column) => column);

  GeneratedColumn<String> get mealType =>
      $composableBuilder(column: $table.mealType, builder: (column) => column);

  GeneratedColumn<String> get photoPath =>
      $composableBuilder(column: $table.photoPath, builder: (column) => column);

  GeneratedColumn<String> get description => $composableBuilder(
    column: $table.description,
    builder: (column) => column,
  );

  GeneratedColumn<String> get locationLabel => $composableBuilder(
    column: $table.locationLabel,
    builder: (column) => column,
  );

  GeneratedColumn<double> get locationLat => $composableBuilder(
    column: $table.locationLat,
    builder: (column) => column,
  );

  GeneratedColumn<double> get locationLng => $composableBuilder(
    column: $table.locationLng,
    builder: (column) => column,
  );

  GeneratedColumn<int> get amount =>
      $composableBuilder(column: $table.amount, builder: (column) => column);

  GeneratedColumn<bool> get isAmountEstimated => $composableBuilder(
    column: $table.isAmountEstimated,
    builder: (column) => column,
  );

  GeneratedColumn<String> get extractedId => $composableBuilder(
    column: $table.extractedId,
    builder: (column) => column,
  );

  GeneratedColumn<String> get nutritionAnalysisJson => $composableBuilder(
    column: $table.nutritionAnalysisJson,
    builder: (column) => column,
  );

  GeneratedColumn<DateTime> get nutritionAnalyzedAt => $composableBuilder(
    column: $table.nutritionAnalyzedAt,
    builder: (column) => column,
  );

  GeneratedColumn<DateTime> get createdAt =>
      $composableBuilder(column: $table.createdAt, builder: (column) => column);
}

class $$MealRecordsTableTableManager
    extends
        RootTableManager<
          _$AppDatabase,
          $MealRecordsTable,
          MealRecord,
          $$MealRecordsTableFilterComposer,
          $$MealRecordsTableOrderingComposer,
          $$MealRecordsTableAnnotationComposer,
          $$MealRecordsTableCreateCompanionBuilder,
          $$MealRecordsTableUpdateCompanionBuilder,
          (
            MealRecord,
            BaseReferences<_$AppDatabase, $MealRecordsTable, MealRecord>,
          ),
          MealRecord,
          PrefetchHooks Function()
        > {
  $$MealRecordsTableTableManager(_$AppDatabase db, $MealRecordsTable table)
    : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$MealRecordsTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$MealRecordsTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$MealRecordsTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback:
              ({
                Value<String> mealId = const Value.absent(),
                Value<String> userId = const Value.absent(),
                Value<DateTime> eatenAt = const Value.absent(),
                Value<String?> mealType = const Value.absent(),
                Value<String?> photoPath = const Value.absent(),
                Value<String?> description = const Value.absent(),
                Value<String?> locationLabel = const Value.absent(),
                Value<double?> locationLat = const Value.absent(),
                Value<double?> locationLng = const Value.absent(),
                Value<int?> amount = const Value.absent(),
                Value<bool> isAmountEstimated = const Value.absent(),
                Value<String?> extractedId = const Value.absent(),
                Value<String?> nutritionAnalysisJson = const Value.absent(),
                Value<DateTime?> nutritionAnalyzedAt = const Value.absent(),
                Value<DateTime> createdAt = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => MealRecordsCompanion(
                mealId: mealId,
                userId: userId,
                eatenAt: eatenAt,
                mealType: mealType,
                photoPath: photoPath,
                description: description,
                locationLabel: locationLabel,
                locationLat: locationLat,
                locationLng: locationLng,
                amount: amount,
                isAmountEstimated: isAmountEstimated,
                extractedId: extractedId,
                nutritionAnalysisJson: nutritionAnalysisJson,
                nutritionAnalyzedAt: nutritionAnalyzedAt,
                createdAt: createdAt,
                rowid: rowid,
              ),
          createCompanionCallback:
              ({
                required String mealId,
                required String userId,
                Value<DateTime> eatenAt = const Value.absent(),
                Value<String?> mealType = const Value.absent(),
                Value<String?> photoPath = const Value.absent(),
                Value<String?> description = const Value.absent(),
                Value<String?> locationLabel = const Value.absent(),
                Value<double?> locationLat = const Value.absent(),
                Value<double?> locationLng = const Value.absent(),
                Value<int?> amount = const Value.absent(),
                Value<bool> isAmountEstimated = const Value.absent(),
                Value<String?> extractedId = const Value.absent(),
                Value<String?> nutritionAnalysisJson = const Value.absent(),
                Value<DateTime?> nutritionAnalyzedAt = const Value.absent(),
                Value<DateTime> createdAt = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => MealRecordsCompanion.insert(
                mealId: mealId,
                userId: userId,
                eatenAt: eatenAt,
                mealType: mealType,
                photoPath: photoPath,
                description: description,
                locationLabel: locationLabel,
                locationLat: locationLat,
                locationLng: locationLng,
                amount: amount,
                isAmountEstimated: isAmountEstimated,
                extractedId: extractedId,
                nutritionAnalysisJson: nutritionAnalysisJson,
                nutritionAnalyzedAt: nutritionAnalyzedAt,
                createdAt: createdAt,
                rowid: rowid,
              ),
          withReferenceMapper: (p0) => p0
              .map((e) => (e.readTable(table), BaseReferences(db, table, e)))
              .toList(),
          prefetchHooksCallback: null,
        ),
      );
}

typedef $$MealRecordsTableProcessedTableManager =
    ProcessedTableManager<
      _$AppDatabase,
      $MealRecordsTable,
      MealRecord,
      $$MealRecordsTableFilterComposer,
      $$MealRecordsTableOrderingComposer,
      $$MealRecordsTableAnnotationComposer,
      $$MealRecordsTableCreateCompanionBuilder,
      $$MealRecordsTableUpdateCompanionBuilder,
      (
        MealRecord,
        BaseReferences<_$AppDatabase, $MealRecordsTable, MealRecord>,
      ),
      MealRecord,
      PrefetchHooks Function()
    >;
typedef $$DailyContextsTableCreateCompanionBuilder =
    DailyContextsCompanion Function({
      required String contextId,
      required String userId,
      Value<DateTime> recordedAt,
      required String memo,
      Value<double?> sleepHours,
      Value<int?> conditionScore,
      Value<String?> weatherLabel,
      Value<double?> weatherTemp,
      Value<DateTime> createdAt,
      Value<int> rowid,
    });
typedef $$DailyContextsTableUpdateCompanionBuilder =
    DailyContextsCompanion Function({
      Value<String> contextId,
      Value<String> userId,
      Value<DateTime> recordedAt,
      Value<String> memo,
      Value<double?> sleepHours,
      Value<int?> conditionScore,
      Value<String?> weatherLabel,
      Value<double?> weatherTemp,
      Value<DateTime> createdAt,
      Value<int> rowid,
    });

class $$DailyContextsTableFilterComposer
    extends Composer<_$AppDatabase, $DailyContextsTable> {
  $$DailyContextsTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get contextId => $composableBuilder(
    column: $table.contextId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get userId => $composableBuilder(
    column: $table.userId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<DateTime> get recordedAt => $composableBuilder(
    column: $table.recordedAt,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get memo => $composableBuilder(
    column: $table.memo,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<double> get sleepHours => $composableBuilder(
    column: $table.sleepHours,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get conditionScore => $composableBuilder(
    column: $table.conditionScore,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get weatherLabel => $composableBuilder(
    column: $table.weatherLabel,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<double> get weatherTemp => $composableBuilder(
    column: $table.weatherTemp,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<DateTime> get createdAt => $composableBuilder(
    column: $table.createdAt,
    builder: (column) => ColumnFilters(column),
  );
}

class $$DailyContextsTableOrderingComposer
    extends Composer<_$AppDatabase, $DailyContextsTable> {
  $$DailyContextsTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get contextId => $composableBuilder(
    column: $table.contextId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get userId => $composableBuilder(
    column: $table.userId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<DateTime> get recordedAt => $composableBuilder(
    column: $table.recordedAt,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get memo => $composableBuilder(
    column: $table.memo,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<double> get sleepHours => $composableBuilder(
    column: $table.sleepHours,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get conditionScore => $composableBuilder(
    column: $table.conditionScore,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get weatherLabel => $composableBuilder(
    column: $table.weatherLabel,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<double> get weatherTemp => $composableBuilder(
    column: $table.weatherTemp,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<DateTime> get createdAt => $composableBuilder(
    column: $table.createdAt,
    builder: (column) => ColumnOrderings(column),
  );
}

class $$DailyContextsTableAnnotationComposer
    extends Composer<_$AppDatabase, $DailyContextsTable> {
  $$DailyContextsTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get contextId =>
      $composableBuilder(column: $table.contextId, builder: (column) => column);

  GeneratedColumn<String> get userId =>
      $composableBuilder(column: $table.userId, builder: (column) => column);

  GeneratedColumn<DateTime> get recordedAt => $composableBuilder(
    column: $table.recordedAt,
    builder: (column) => column,
  );

  GeneratedColumn<String> get memo =>
      $composableBuilder(column: $table.memo, builder: (column) => column);

  GeneratedColumn<double> get sleepHours => $composableBuilder(
    column: $table.sleepHours,
    builder: (column) => column,
  );

  GeneratedColumn<int> get conditionScore => $composableBuilder(
    column: $table.conditionScore,
    builder: (column) => column,
  );

  GeneratedColumn<String> get weatherLabel => $composableBuilder(
    column: $table.weatherLabel,
    builder: (column) => column,
  );

  GeneratedColumn<double> get weatherTemp => $composableBuilder(
    column: $table.weatherTemp,
    builder: (column) => column,
  );

  GeneratedColumn<DateTime> get createdAt =>
      $composableBuilder(column: $table.createdAt, builder: (column) => column);
}

class $$DailyContextsTableTableManager
    extends
        RootTableManager<
          _$AppDatabase,
          $DailyContextsTable,
          DailyContext,
          $$DailyContextsTableFilterComposer,
          $$DailyContextsTableOrderingComposer,
          $$DailyContextsTableAnnotationComposer,
          $$DailyContextsTableCreateCompanionBuilder,
          $$DailyContextsTableUpdateCompanionBuilder,
          (
            DailyContext,
            BaseReferences<_$AppDatabase, $DailyContextsTable, DailyContext>,
          ),
          DailyContext,
          PrefetchHooks Function()
        > {
  $$DailyContextsTableTableManager(_$AppDatabase db, $DailyContextsTable table)
    : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$DailyContextsTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$DailyContextsTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$DailyContextsTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback:
              ({
                Value<String> contextId = const Value.absent(),
                Value<String> userId = const Value.absent(),
                Value<DateTime> recordedAt = const Value.absent(),
                Value<String> memo = const Value.absent(),
                Value<double?> sleepHours = const Value.absent(),
                Value<int?> conditionScore = const Value.absent(),
                Value<String?> weatherLabel = const Value.absent(),
                Value<double?> weatherTemp = const Value.absent(),
                Value<DateTime> createdAt = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => DailyContextsCompanion(
                contextId: contextId,
                userId: userId,
                recordedAt: recordedAt,
                memo: memo,
                sleepHours: sleepHours,
                conditionScore: conditionScore,
                weatherLabel: weatherLabel,
                weatherTemp: weatherTemp,
                createdAt: createdAt,
                rowid: rowid,
              ),
          createCompanionCallback:
              ({
                required String contextId,
                required String userId,
                Value<DateTime> recordedAt = const Value.absent(),
                required String memo,
                Value<double?> sleepHours = const Value.absent(),
                Value<int?> conditionScore = const Value.absent(),
                Value<String?> weatherLabel = const Value.absent(),
                Value<double?> weatherTemp = const Value.absent(),
                Value<DateTime> createdAt = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => DailyContextsCompanion.insert(
                contextId: contextId,
                userId: userId,
                recordedAt: recordedAt,
                memo: memo,
                sleepHours: sleepHours,
                conditionScore: conditionScore,
                weatherLabel: weatherLabel,
                weatherTemp: weatherTemp,
                createdAt: createdAt,
                rowid: rowid,
              ),
          withReferenceMapper: (p0) => p0
              .map((e) => (e.readTable(table), BaseReferences(db, table, e)))
              .toList(),
          prefetchHooksCallback: null,
        ),
      );
}

typedef $$DailyContextsTableProcessedTableManager =
    ProcessedTableManager<
      _$AppDatabase,
      $DailyContextsTable,
      DailyContext,
      $$DailyContextsTableFilterComposer,
      $$DailyContextsTableOrderingComposer,
      $$DailyContextsTableAnnotationComposer,
      $$DailyContextsTableCreateCompanionBuilder,
      $$DailyContextsTableUpdateCompanionBuilder,
      (
        DailyContext,
        BaseReferences<_$AppDatabase, $DailyContextsTable, DailyContext>,
      ),
      DailyContext,
      PrefetchHooks Function()
    >;
typedef $$MedicationRecordsTableCreateCompanionBuilder =
    MedicationRecordsCompanion Function({
      required String medicationId,
      required String userId,
      Value<DateTime> takenAt,
      required String name,
      Value<String?> dosage,
      Value<String?> memo,
      Value<bool> isPrescription,
      Value<DateTime> createdAt,
      Value<int> rowid,
    });
typedef $$MedicationRecordsTableUpdateCompanionBuilder =
    MedicationRecordsCompanion Function({
      Value<String> medicationId,
      Value<String> userId,
      Value<DateTime> takenAt,
      Value<String> name,
      Value<String?> dosage,
      Value<String?> memo,
      Value<bool> isPrescription,
      Value<DateTime> createdAt,
      Value<int> rowid,
    });

class $$MedicationRecordsTableFilterComposer
    extends Composer<_$AppDatabase, $MedicationRecordsTable> {
  $$MedicationRecordsTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get medicationId => $composableBuilder(
    column: $table.medicationId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get userId => $composableBuilder(
    column: $table.userId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<DateTime> get takenAt => $composableBuilder(
    column: $table.takenAt,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get name => $composableBuilder(
    column: $table.name,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get dosage => $composableBuilder(
    column: $table.dosage,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get memo => $composableBuilder(
    column: $table.memo,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<bool> get isPrescription => $composableBuilder(
    column: $table.isPrescription,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<DateTime> get createdAt => $composableBuilder(
    column: $table.createdAt,
    builder: (column) => ColumnFilters(column),
  );
}

class $$MedicationRecordsTableOrderingComposer
    extends Composer<_$AppDatabase, $MedicationRecordsTable> {
  $$MedicationRecordsTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get medicationId => $composableBuilder(
    column: $table.medicationId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get userId => $composableBuilder(
    column: $table.userId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<DateTime> get takenAt => $composableBuilder(
    column: $table.takenAt,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get name => $composableBuilder(
    column: $table.name,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get dosage => $composableBuilder(
    column: $table.dosage,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get memo => $composableBuilder(
    column: $table.memo,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<bool> get isPrescription => $composableBuilder(
    column: $table.isPrescription,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<DateTime> get createdAt => $composableBuilder(
    column: $table.createdAt,
    builder: (column) => ColumnOrderings(column),
  );
}

class $$MedicationRecordsTableAnnotationComposer
    extends Composer<_$AppDatabase, $MedicationRecordsTable> {
  $$MedicationRecordsTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get medicationId => $composableBuilder(
    column: $table.medicationId,
    builder: (column) => column,
  );

  GeneratedColumn<String> get userId =>
      $composableBuilder(column: $table.userId, builder: (column) => column);

  GeneratedColumn<DateTime> get takenAt =>
      $composableBuilder(column: $table.takenAt, builder: (column) => column);

  GeneratedColumn<String> get name =>
      $composableBuilder(column: $table.name, builder: (column) => column);

  GeneratedColumn<String> get dosage =>
      $composableBuilder(column: $table.dosage, builder: (column) => column);

  GeneratedColumn<String> get memo =>
      $composableBuilder(column: $table.memo, builder: (column) => column);

  GeneratedColumn<bool> get isPrescription => $composableBuilder(
    column: $table.isPrescription,
    builder: (column) => column,
  );

  GeneratedColumn<DateTime> get createdAt =>
      $composableBuilder(column: $table.createdAt, builder: (column) => column);
}

class $$MedicationRecordsTableTableManager
    extends
        RootTableManager<
          _$AppDatabase,
          $MedicationRecordsTable,
          MedicationRecord,
          $$MedicationRecordsTableFilterComposer,
          $$MedicationRecordsTableOrderingComposer,
          $$MedicationRecordsTableAnnotationComposer,
          $$MedicationRecordsTableCreateCompanionBuilder,
          $$MedicationRecordsTableUpdateCompanionBuilder,
          (
            MedicationRecord,
            BaseReferences<
              _$AppDatabase,
              $MedicationRecordsTable,
              MedicationRecord
            >,
          ),
          MedicationRecord,
          PrefetchHooks Function()
        > {
  $$MedicationRecordsTableTableManager(
    _$AppDatabase db,
    $MedicationRecordsTable table,
  ) : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$MedicationRecordsTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$MedicationRecordsTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$MedicationRecordsTableAnnotationComposer(
                $db: db,
                $table: table,
              ),
          updateCompanionCallback:
              ({
                Value<String> medicationId = const Value.absent(),
                Value<String> userId = const Value.absent(),
                Value<DateTime> takenAt = const Value.absent(),
                Value<String> name = const Value.absent(),
                Value<String?> dosage = const Value.absent(),
                Value<String?> memo = const Value.absent(),
                Value<bool> isPrescription = const Value.absent(),
                Value<DateTime> createdAt = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => MedicationRecordsCompanion(
                medicationId: medicationId,
                userId: userId,
                takenAt: takenAt,
                name: name,
                dosage: dosage,
                memo: memo,
                isPrescription: isPrescription,
                createdAt: createdAt,
                rowid: rowid,
              ),
          createCompanionCallback:
              ({
                required String medicationId,
                required String userId,
                Value<DateTime> takenAt = const Value.absent(),
                required String name,
                Value<String?> dosage = const Value.absent(),
                Value<String?> memo = const Value.absent(),
                Value<bool> isPrescription = const Value.absent(),
                Value<DateTime> createdAt = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => MedicationRecordsCompanion.insert(
                medicationId: medicationId,
                userId: userId,
                takenAt: takenAt,
                name: name,
                dosage: dosage,
                memo: memo,
                isPrescription: isPrescription,
                createdAt: createdAt,
                rowid: rowid,
              ),
          withReferenceMapper: (p0) => p0
              .map((e) => (e.readTable(table), BaseReferences(db, table, e)))
              .toList(),
          prefetchHooksCallback: null,
        ),
      );
}

typedef $$MedicationRecordsTableProcessedTableManager =
    ProcessedTableManager<
      _$AppDatabase,
      $MedicationRecordsTable,
      MedicationRecord,
      $$MedicationRecordsTableFilterComposer,
      $$MedicationRecordsTableOrderingComposer,
      $$MedicationRecordsTableAnnotationComposer,
      $$MedicationRecordsTableCreateCompanionBuilder,
      $$MedicationRecordsTableUpdateCompanionBuilder,
      (
        MedicationRecord,
        BaseReferences<
          _$AppDatabase,
          $MedicationRecordsTable,
          MedicationRecord
        >,
      ),
      MedicationRecord,
      PrefetchHooks Function()
    >;
typedef $$ExerciseRecordsTableCreateCompanionBuilder =
    ExerciseRecordsCompanion Function({
      required String exerciseId,
      required String userId,
      Value<DateTime> startedAt,
      Value<DateTime?> endedAt,
      required String exerciseType,
      Value<int?> durationMinutes,
      Value<String?> intensity,
      Value<String?> locationLabel,
      Value<String?> memo,
      Value<int?> estimatedCalories,
      Value<DateTime> createdAt,
      Value<int> rowid,
    });
typedef $$ExerciseRecordsTableUpdateCompanionBuilder =
    ExerciseRecordsCompanion Function({
      Value<String> exerciseId,
      Value<String> userId,
      Value<DateTime> startedAt,
      Value<DateTime?> endedAt,
      Value<String> exerciseType,
      Value<int?> durationMinutes,
      Value<String?> intensity,
      Value<String?> locationLabel,
      Value<String?> memo,
      Value<int?> estimatedCalories,
      Value<DateTime> createdAt,
      Value<int> rowid,
    });

class $$ExerciseRecordsTableFilterComposer
    extends Composer<_$AppDatabase, $ExerciseRecordsTable> {
  $$ExerciseRecordsTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get exerciseId => $composableBuilder(
    column: $table.exerciseId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get userId => $composableBuilder(
    column: $table.userId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<DateTime> get startedAt => $composableBuilder(
    column: $table.startedAt,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<DateTime> get endedAt => $composableBuilder(
    column: $table.endedAt,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get exerciseType => $composableBuilder(
    column: $table.exerciseType,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get durationMinutes => $composableBuilder(
    column: $table.durationMinutes,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get intensity => $composableBuilder(
    column: $table.intensity,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get locationLabel => $composableBuilder(
    column: $table.locationLabel,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get memo => $composableBuilder(
    column: $table.memo,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get estimatedCalories => $composableBuilder(
    column: $table.estimatedCalories,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<DateTime> get createdAt => $composableBuilder(
    column: $table.createdAt,
    builder: (column) => ColumnFilters(column),
  );
}

class $$ExerciseRecordsTableOrderingComposer
    extends Composer<_$AppDatabase, $ExerciseRecordsTable> {
  $$ExerciseRecordsTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get exerciseId => $composableBuilder(
    column: $table.exerciseId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get userId => $composableBuilder(
    column: $table.userId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<DateTime> get startedAt => $composableBuilder(
    column: $table.startedAt,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<DateTime> get endedAt => $composableBuilder(
    column: $table.endedAt,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get exerciseType => $composableBuilder(
    column: $table.exerciseType,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get durationMinutes => $composableBuilder(
    column: $table.durationMinutes,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get intensity => $composableBuilder(
    column: $table.intensity,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get locationLabel => $composableBuilder(
    column: $table.locationLabel,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get memo => $composableBuilder(
    column: $table.memo,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get estimatedCalories => $composableBuilder(
    column: $table.estimatedCalories,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<DateTime> get createdAt => $composableBuilder(
    column: $table.createdAt,
    builder: (column) => ColumnOrderings(column),
  );
}

class $$ExerciseRecordsTableAnnotationComposer
    extends Composer<_$AppDatabase, $ExerciseRecordsTable> {
  $$ExerciseRecordsTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get exerciseId => $composableBuilder(
    column: $table.exerciseId,
    builder: (column) => column,
  );

  GeneratedColumn<String> get userId =>
      $composableBuilder(column: $table.userId, builder: (column) => column);

  GeneratedColumn<DateTime> get startedAt =>
      $composableBuilder(column: $table.startedAt, builder: (column) => column);

  GeneratedColumn<DateTime> get endedAt =>
      $composableBuilder(column: $table.endedAt, builder: (column) => column);

  GeneratedColumn<String> get exerciseType => $composableBuilder(
    column: $table.exerciseType,
    builder: (column) => column,
  );

  GeneratedColumn<int> get durationMinutes => $composableBuilder(
    column: $table.durationMinutes,
    builder: (column) => column,
  );

  GeneratedColumn<String> get intensity =>
      $composableBuilder(column: $table.intensity, builder: (column) => column);

  GeneratedColumn<String> get locationLabel => $composableBuilder(
    column: $table.locationLabel,
    builder: (column) => column,
  );

  GeneratedColumn<String> get memo =>
      $composableBuilder(column: $table.memo, builder: (column) => column);

  GeneratedColumn<int> get estimatedCalories => $composableBuilder(
    column: $table.estimatedCalories,
    builder: (column) => column,
  );

  GeneratedColumn<DateTime> get createdAt =>
      $composableBuilder(column: $table.createdAt, builder: (column) => column);
}

class $$ExerciseRecordsTableTableManager
    extends
        RootTableManager<
          _$AppDatabase,
          $ExerciseRecordsTable,
          ExerciseRecord,
          $$ExerciseRecordsTableFilterComposer,
          $$ExerciseRecordsTableOrderingComposer,
          $$ExerciseRecordsTableAnnotationComposer,
          $$ExerciseRecordsTableCreateCompanionBuilder,
          $$ExerciseRecordsTableUpdateCompanionBuilder,
          (
            ExerciseRecord,
            BaseReferences<
              _$AppDatabase,
              $ExerciseRecordsTable,
              ExerciseRecord
            >,
          ),
          ExerciseRecord,
          PrefetchHooks Function()
        > {
  $$ExerciseRecordsTableTableManager(
    _$AppDatabase db,
    $ExerciseRecordsTable table,
  ) : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$ExerciseRecordsTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$ExerciseRecordsTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$ExerciseRecordsTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback:
              ({
                Value<String> exerciseId = const Value.absent(),
                Value<String> userId = const Value.absent(),
                Value<DateTime> startedAt = const Value.absent(),
                Value<DateTime?> endedAt = const Value.absent(),
                Value<String> exerciseType = const Value.absent(),
                Value<int?> durationMinutes = const Value.absent(),
                Value<String?> intensity = const Value.absent(),
                Value<String?> locationLabel = const Value.absent(),
                Value<String?> memo = const Value.absent(),
                Value<int?> estimatedCalories = const Value.absent(),
                Value<DateTime> createdAt = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => ExerciseRecordsCompanion(
                exerciseId: exerciseId,
                userId: userId,
                startedAt: startedAt,
                endedAt: endedAt,
                exerciseType: exerciseType,
                durationMinutes: durationMinutes,
                intensity: intensity,
                locationLabel: locationLabel,
                memo: memo,
                estimatedCalories: estimatedCalories,
                createdAt: createdAt,
                rowid: rowid,
              ),
          createCompanionCallback:
              ({
                required String exerciseId,
                required String userId,
                Value<DateTime> startedAt = const Value.absent(),
                Value<DateTime?> endedAt = const Value.absent(),
                required String exerciseType,
                Value<int?> durationMinutes = const Value.absent(),
                Value<String?> intensity = const Value.absent(),
                Value<String?> locationLabel = const Value.absent(),
                Value<String?> memo = const Value.absent(),
                Value<int?> estimatedCalories = const Value.absent(),
                Value<DateTime> createdAt = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => ExerciseRecordsCompanion.insert(
                exerciseId: exerciseId,
                userId: userId,
                startedAt: startedAt,
                endedAt: endedAt,
                exerciseType: exerciseType,
                durationMinutes: durationMinutes,
                intensity: intensity,
                locationLabel: locationLabel,
                memo: memo,
                estimatedCalories: estimatedCalories,
                createdAt: createdAt,
                rowid: rowid,
              ),
          withReferenceMapper: (p0) => p0
              .map((e) => (e.readTable(table), BaseReferences(db, table, e)))
              .toList(),
          prefetchHooksCallback: null,
        ),
      );
}

typedef $$ExerciseRecordsTableProcessedTableManager =
    ProcessedTableManager<
      _$AppDatabase,
      $ExerciseRecordsTable,
      ExerciseRecord,
      $$ExerciseRecordsTableFilterComposer,
      $$ExerciseRecordsTableOrderingComposer,
      $$ExerciseRecordsTableAnnotationComposer,
      $$ExerciseRecordsTableCreateCompanionBuilder,
      $$ExerciseRecordsTableUpdateCompanionBuilder,
      (
        ExerciseRecord,
        BaseReferences<_$AppDatabase, $ExerciseRecordsTable, ExerciseRecord>,
      ),
      ExerciseRecord,
      PrefetchHooks Function()
    >;
typedef $$HospitalRecordsTableCreateCompanionBuilder =
    HospitalRecordsCompanion Function({
      required String hospitalId,
      required String userId,
      Value<DateTime> visitedAt,
      required String hospitalName,
      Value<String?> department,
      Value<String?> reason,
      Value<String?> diagnosis,
      Value<String?> memo,
      Value<int?> amount,
      Value<DateTime> createdAt,
      Value<int> rowid,
    });
typedef $$HospitalRecordsTableUpdateCompanionBuilder =
    HospitalRecordsCompanion Function({
      Value<String> hospitalId,
      Value<String> userId,
      Value<DateTime> visitedAt,
      Value<String> hospitalName,
      Value<String?> department,
      Value<String?> reason,
      Value<String?> diagnosis,
      Value<String?> memo,
      Value<int?> amount,
      Value<DateTime> createdAt,
      Value<int> rowid,
    });

class $$HospitalRecordsTableFilterComposer
    extends Composer<_$AppDatabase, $HospitalRecordsTable> {
  $$HospitalRecordsTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get hospitalId => $composableBuilder(
    column: $table.hospitalId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get userId => $composableBuilder(
    column: $table.userId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<DateTime> get visitedAt => $composableBuilder(
    column: $table.visitedAt,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get hospitalName => $composableBuilder(
    column: $table.hospitalName,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get department => $composableBuilder(
    column: $table.department,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get reason => $composableBuilder(
    column: $table.reason,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get diagnosis => $composableBuilder(
    column: $table.diagnosis,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get memo => $composableBuilder(
    column: $table.memo,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get amount => $composableBuilder(
    column: $table.amount,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<DateTime> get createdAt => $composableBuilder(
    column: $table.createdAt,
    builder: (column) => ColumnFilters(column),
  );
}

class $$HospitalRecordsTableOrderingComposer
    extends Composer<_$AppDatabase, $HospitalRecordsTable> {
  $$HospitalRecordsTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get hospitalId => $composableBuilder(
    column: $table.hospitalId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get userId => $composableBuilder(
    column: $table.userId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<DateTime> get visitedAt => $composableBuilder(
    column: $table.visitedAt,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get hospitalName => $composableBuilder(
    column: $table.hospitalName,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get department => $composableBuilder(
    column: $table.department,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get reason => $composableBuilder(
    column: $table.reason,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get diagnosis => $composableBuilder(
    column: $table.diagnosis,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get memo => $composableBuilder(
    column: $table.memo,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get amount => $composableBuilder(
    column: $table.amount,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<DateTime> get createdAt => $composableBuilder(
    column: $table.createdAt,
    builder: (column) => ColumnOrderings(column),
  );
}

class $$HospitalRecordsTableAnnotationComposer
    extends Composer<_$AppDatabase, $HospitalRecordsTable> {
  $$HospitalRecordsTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get hospitalId => $composableBuilder(
    column: $table.hospitalId,
    builder: (column) => column,
  );

  GeneratedColumn<String> get userId =>
      $composableBuilder(column: $table.userId, builder: (column) => column);

  GeneratedColumn<DateTime> get visitedAt =>
      $composableBuilder(column: $table.visitedAt, builder: (column) => column);

  GeneratedColumn<String> get hospitalName => $composableBuilder(
    column: $table.hospitalName,
    builder: (column) => column,
  );

  GeneratedColumn<String> get department => $composableBuilder(
    column: $table.department,
    builder: (column) => column,
  );

  GeneratedColumn<String> get reason =>
      $composableBuilder(column: $table.reason, builder: (column) => column);

  GeneratedColumn<String> get diagnosis =>
      $composableBuilder(column: $table.diagnosis, builder: (column) => column);

  GeneratedColumn<String> get memo =>
      $composableBuilder(column: $table.memo, builder: (column) => column);

  GeneratedColumn<int> get amount =>
      $composableBuilder(column: $table.amount, builder: (column) => column);

  GeneratedColumn<DateTime> get createdAt =>
      $composableBuilder(column: $table.createdAt, builder: (column) => column);
}

class $$HospitalRecordsTableTableManager
    extends
        RootTableManager<
          _$AppDatabase,
          $HospitalRecordsTable,
          HospitalRecord,
          $$HospitalRecordsTableFilterComposer,
          $$HospitalRecordsTableOrderingComposer,
          $$HospitalRecordsTableAnnotationComposer,
          $$HospitalRecordsTableCreateCompanionBuilder,
          $$HospitalRecordsTableUpdateCompanionBuilder,
          (
            HospitalRecord,
            BaseReferences<
              _$AppDatabase,
              $HospitalRecordsTable,
              HospitalRecord
            >,
          ),
          HospitalRecord,
          PrefetchHooks Function()
        > {
  $$HospitalRecordsTableTableManager(
    _$AppDatabase db,
    $HospitalRecordsTable table,
  ) : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$HospitalRecordsTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$HospitalRecordsTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$HospitalRecordsTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback:
              ({
                Value<String> hospitalId = const Value.absent(),
                Value<String> userId = const Value.absent(),
                Value<DateTime> visitedAt = const Value.absent(),
                Value<String> hospitalName = const Value.absent(),
                Value<String?> department = const Value.absent(),
                Value<String?> reason = const Value.absent(),
                Value<String?> diagnosis = const Value.absent(),
                Value<String?> memo = const Value.absent(),
                Value<int?> amount = const Value.absent(),
                Value<DateTime> createdAt = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => HospitalRecordsCompanion(
                hospitalId: hospitalId,
                userId: userId,
                visitedAt: visitedAt,
                hospitalName: hospitalName,
                department: department,
                reason: reason,
                diagnosis: diagnosis,
                memo: memo,
                amount: amount,
                createdAt: createdAt,
                rowid: rowid,
              ),
          createCompanionCallback:
              ({
                required String hospitalId,
                required String userId,
                Value<DateTime> visitedAt = const Value.absent(),
                required String hospitalName,
                Value<String?> department = const Value.absent(),
                Value<String?> reason = const Value.absent(),
                Value<String?> diagnosis = const Value.absent(),
                Value<String?> memo = const Value.absent(),
                Value<int?> amount = const Value.absent(),
                Value<DateTime> createdAt = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => HospitalRecordsCompanion.insert(
                hospitalId: hospitalId,
                userId: userId,
                visitedAt: visitedAt,
                hospitalName: hospitalName,
                department: department,
                reason: reason,
                diagnosis: diagnosis,
                memo: memo,
                amount: amount,
                createdAt: createdAt,
                rowid: rowid,
              ),
          withReferenceMapper: (p0) => p0
              .map((e) => (e.readTable(table), BaseReferences(db, table, e)))
              .toList(),
          prefetchHooksCallback: null,
        ),
      );
}

typedef $$HospitalRecordsTableProcessedTableManager =
    ProcessedTableManager<
      _$AppDatabase,
      $HospitalRecordsTable,
      HospitalRecord,
      $$HospitalRecordsTableFilterComposer,
      $$HospitalRecordsTableOrderingComposer,
      $$HospitalRecordsTableAnnotationComposer,
      $$HospitalRecordsTableCreateCompanionBuilder,
      $$HospitalRecordsTableUpdateCompanionBuilder,
      (
        HospitalRecord,
        BaseReferences<_$AppDatabase, $HospitalRecordsTable, HospitalRecord>,
      ),
      HospitalRecord,
      PrefetchHooks Function()
    >;
typedef $$SleepRecordsTableCreateCompanionBuilder =
    SleepRecordsCompanion Function({
      required String sleepId,
      required String userId,
      required DateTime bedAt,
      Value<DateTime?> wokeAt,
      Value<int?> qualityScore,
      Value<String?> memo,
      Value<DateTime> createdAt,
      Value<int> rowid,
    });
typedef $$SleepRecordsTableUpdateCompanionBuilder =
    SleepRecordsCompanion Function({
      Value<String> sleepId,
      Value<String> userId,
      Value<DateTime> bedAt,
      Value<DateTime?> wokeAt,
      Value<int?> qualityScore,
      Value<String?> memo,
      Value<DateTime> createdAt,
      Value<int> rowid,
    });

class $$SleepRecordsTableFilterComposer
    extends Composer<_$AppDatabase, $SleepRecordsTable> {
  $$SleepRecordsTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get sleepId => $composableBuilder(
    column: $table.sleepId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get userId => $composableBuilder(
    column: $table.userId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<DateTime> get bedAt => $composableBuilder(
    column: $table.bedAt,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<DateTime> get wokeAt => $composableBuilder(
    column: $table.wokeAt,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get qualityScore => $composableBuilder(
    column: $table.qualityScore,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get memo => $composableBuilder(
    column: $table.memo,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<DateTime> get createdAt => $composableBuilder(
    column: $table.createdAt,
    builder: (column) => ColumnFilters(column),
  );
}

class $$SleepRecordsTableOrderingComposer
    extends Composer<_$AppDatabase, $SleepRecordsTable> {
  $$SleepRecordsTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get sleepId => $composableBuilder(
    column: $table.sleepId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get userId => $composableBuilder(
    column: $table.userId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<DateTime> get bedAt => $composableBuilder(
    column: $table.bedAt,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<DateTime> get wokeAt => $composableBuilder(
    column: $table.wokeAt,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get qualityScore => $composableBuilder(
    column: $table.qualityScore,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get memo => $composableBuilder(
    column: $table.memo,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<DateTime> get createdAt => $composableBuilder(
    column: $table.createdAt,
    builder: (column) => ColumnOrderings(column),
  );
}

class $$SleepRecordsTableAnnotationComposer
    extends Composer<_$AppDatabase, $SleepRecordsTable> {
  $$SleepRecordsTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get sleepId =>
      $composableBuilder(column: $table.sleepId, builder: (column) => column);

  GeneratedColumn<String> get userId =>
      $composableBuilder(column: $table.userId, builder: (column) => column);

  GeneratedColumn<DateTime> get bedAt =>
      $composableBuilder(column: $table.bedAt, builder: (column) => column);

  GeneratedColumn<DateTime> get wokeAt =>
      $composableBuilder(column: $table.wokeAt, builder: (column) => column);

  GeneratedColumn<int> get qualityScore => $composableBuilder(
    column: $table.qualityScore,
    builder: (column) => column,
  );

  GeneratedColumn<String> get memo =>
      $composableBuilder(column: $table.memo, builder: (column) => column);

  GeneratedColumn<DateTime> get createdAt =>
      $composableBuilder(column: $table.createdAt, builder: (column) => column);
}

class $$SleepRecordsTableTableManager
    extends
        RootTableManager<
          _$AppDatabase,
          $SleepRecordsTable,
          SleepRecord,
          $$SleepRecordsTableFilterComposer,
          $$SleepRecordsTableOrderingComposer,
          $$SleepRecordsTableAnnotationComposer,
          $$SleepRecordsTableCreateCompanionBuilder,
          $$SleepRecordsTableUpdateCompanionBuilder,
          (
            SleepRecord,
            BaseReferences<_$AppDatabase, $SleepRecordsTable, SleepRecord>,
          ),
          SleepRecord,
          PrefetchHooks Function()
        > {
  $$SleepRecordsTableTableManager(_$AppDatabase db, $SleepRecordsTable table)
    : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$SleepRecordsTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$SleepRecordsTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$SleepRecordsTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback:
              ({
                Value<String> sleepId = const Value.absent(),
                Value<String> userId = const Value.absent(),
                Value<DateTime> bedAt = const Value.absent(),
                Value<DateTime?> wokeAt = const Value.absent(),
                Value<int?> qualityScore = const Value.absent(),
                Value<String?> memo = const Value.absent(),
                Value<DateTime> createdAt = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => SleepRecordsCompanion(
                sleepId: sleepId,
                userId: userId,
                bedAt: bedAt,
                wokeAt: wokeAt,
                qualityScore: qualityScore,
                memo: memo,
                createdAt: createdAt,
                rowid: rowid,
              ),
          createCompanionCallback:
              ({
                required String sleepId,
                required String userId,
                required DateTime bedAt,
                Value<DateTime?> wokeAt = const Value.absent(),
                Value<int?> qualityScore = const Value.absent(),
                Value<String?> memo = const Value.absent(),
                Value<DateTime> createdAt = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => SleepRecordsCompanion.insert(
                sleepId: sleepId,
                userId: userId,
                bedAt: bedAt,
                wokeAt: wokeAt,
                qualityScore: qualityScore,
                memo: memo,
                createdAt: createdAt,
                rowid: rowid,
              ),
          withReferenceMapper: (p0) => p0
              .map((e) => (e.readTable(table), BaseReferences(db, table, e)))
              .toList(),
          prefetchHooksCallback: null,
        ),
      );
}

typedef $$SleepRecordsTableProcessedTableManager =
    ProcessedTableManager<
      _$AppDatabase,
      $SleepRecordsTable,
      SleepRecord,
      $$SleepRecordsTableFilterComposer,
      $$SleepRecordsTableOrderingComposer,
      $$SleepRecordsTableAnnotationComposer,
      $$SleepRecordsTableCreateCompanionBuilder,
      $$SleepRecordsTableUpdateCompanionBuilder,
      (
        SleepRecord,
        BaseReferences<_$AppDatabase, $SleepRecordsTable, SleepRecord>,
      ),
      SleepRecord,
      PrefetchHooks Function()
    >;
typedef $$RoutineItemsTableCreateCompanionBuilder =
    RoutineItemsCompanion Function({
      required String routineId,
      required String userId,
      required String name,
      Value<String> repeat,
      Value<String?> weekdaysJson,
      Value<String?> alertTime,
      Value<bool> isEnabled,
      Value<int> sortOrder,
      Value<DateTime> createdAt,
      Value<DateTime> updatedAt,
      Value<int> rowid,
    });
typedef $$RoutineItemsTableUpdateCompanionBuilder =
    RoutineItemsCompanion Function({
      Value<String> routineId,
      Value<String> userId,
      Value<String> name,
      Value<String> repeat,
      Value<String?> weekdaysJson,
      Value<String?> alertTime,
      Value<bool> isEnabled,
      Value<int> sortOrder,
      Value<DateTime> createdAt,
      Value<DateTime> updatedAt,
      Value<int> rowid,
    });

class $$RoutineItemsTableFilterComposer
    extends Composer<_$AppDatabase, $RoutineItemsTable> {
  $$RoutineItemsTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get routineId => $composableBuilder(
    column: $table.routineId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get userId => $composableBuilder(
    column: $table.userId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get name => $composableBuilder(
    column: $table.name,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get repeat => $composableBuilder(
    column: $table.repeat,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get weekdaysJson => $composableBuilder(
    column: $table.weekdaysJson,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get alertTime => $composableBuilder(
    column: $table.alertTime,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<bool> get isEnabled => $composableBuilder(
    column: $table.isEnabled,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get sortOrder => $composableBuilder(
    column: $table.sortOrder,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<DateTime> get createdAt => $composableBuilder(
    column: $table.createdAt,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<DateTime> get updatedAt => $composableBuilder(
    column: $table.updatedAt,
    builder: (column) => ColumnFilters(column),
  );
}

class $$RoutineItemsTableOrderingComposer
    extends Composer<_$AppDatabase, $RoutineItemsTable> {
  $$RoutineItemsTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get routineId => $composableBuilder(
    column: $table.routineId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get userId => $composableBuilder(
    column: $table.userId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get name => $composableBuilder(
    column: $table.name,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get repeat => $composableBuilder(
    column: $table.repeat,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get weekdaysJson => $composableBuilder(
    column: $table.weekdaysJson,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get alertTime => $composableBuilder(
    column: $table.alertTime,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<bool> get isEnabled => $composableBuilder(
    column: $table.isEnabled,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get sortOrder => $composableBuilder(
    column: $table.sortOrder,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<DateTime> get createdAt => $composableBuilder(
    column: $table.createdAt,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<DateTime> get updatedAt => $composableBuilder(
    column: $table.updatedAt,
    builder: (column) => ColumnOrderings(column),
  );
}

class $$RoutineItemsTableAnnotationComposer
    extends Composer<_$AppDatabase, $RoutineItemsTable> {
  $$RoutineItemsTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get routineId =>
      $composableBuilder(column: $table.routineId, builder: (column) => column);

  GeneratedColumn<String> get userId =>
      $composableBuilder(column: $table.userId, builder: (column) => column);

  GeneratedColumn<String> get name =>
      $composableBuilder(column: $table.name, builder: (column) => column);

  GeneratedColumn<String> get repeat =>
      $composableBuilder(column: $table.repeat, builder: (column) => column);

  GeneratedColumn<String> get weekdaysJson => $composableBuilder(
    column: $table.weekdaysJson,
    builder: (column) => column,
  );

  GeneratedColumn<String> get alertTime =>
      $composableBuilder(column: $table.alertTime, builder: (column) => column);

  GeneratedColumn<bool> get isEnabled =>
      $composableBuilder(column: $table.isEnabled, builder: (column) => column);

  GeneratedColumn<int> get sortOrder =>
      $composableBuilder(column: $table.sortOrder, builder: (column) => column);

  GeneratedColumn<DateTime> get createdAt =>
      $composableBuilder(column: $table.createdAt, builder: (column) => column);

  GeneratedColumn<DateTime> get updatedAt =>
      $composableBuilder(column: $table.updatedAt, builder: (column) => column);
}

class $$RoutineItemsTableTableManager
    extends
        RootTableManager<
          _$AppDatabase,
          $RoutineItemsTable,
          RoutineItem,
          $$RoutineItemsTableFilterComposer,
          $$RoutineItemsTableOrderingComposer,
          $$RoutineItemsTableAnnotationComposer,
          $$RoutineItemsTableCreateCompanionBuilder,
          $$RoutineItemsTableUpdateCompanionBuilder,
          (
            RoutineItem,
            BaseReferences<_$AppDatabase, $RoutineItemsTable, RoutineItem>,
          ),
          RoutineItem,
          PrefetchHooks Function()
        > {
  $$RoutineItemsTableTableManager(_$AppDatabase db, $RoutineItemsTable table)
    : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$RoutineItemsTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$RoutineItemsTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$RoutineItemsTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback:
              ({
                Value<String> routineId = const Value.absent(),
                Value<String> userId = const Value.absent(),
                Value<String> name = const Value.absent(),
                Value<String> repeat = const Value.absent(),
                Value<String?> weekdaysJson = const Value.absent(),
                Value<String?> alertTime = const Value.absent(),
                Value<bool> isEnabled = const Value.absent(),
                Value<int> sortOrder = const Value.absent(),
                Value<DateTime> createdAt = const Value.absent(),
                Value<DateTime> updatedAt = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => RoutineItemsCompanion(
                routineId: routineId,
                userId: userId,
                name: name,
                repeat: repeat,
                weekdaysJson: weekdaysJson,
                alertTime: alertTime,
                isEnabled: isEnabled,
                sortOrder: sortOrder,
                createdAt: createdAt,
                updatedAt: updatedAt,
                rowid: rowid,
              ),
          createCompanionCallback:
              ({
                required String routineId,
                required String userId,
                required String name,
                Value<String> repeat = const Value.absent(),
                Value<String?> weekdaysJson = const Value.absent(),
                Value<String?> alertTime = const Value.absent(),
                Value<bool> isEnabled = const Value.absent(),
                Value<int> sortOrder = const Value.absent(),
                Value<DateTime> createdAt = const Value.absent(),
                Value<DateTime> updatedAt = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => RoutineItemsCompanion.insert(
                routineId: routineId,
                userId: userId,
                name: name,
                repeat: repeat,
                weekdaysJson: weekdaysJson,
                alertTime: alertTime,
                isEnabled: isEnabled,
                sortOrder: sortOrder,
                createdAt: createdAt,
                updatedAt: updatedAt,
                rowid: rowid,
              ),
          withReferenceMapper: (p0) => p0
              .map((e) => (e.readTable(table), BaseReferences(db, table, e)))
              .toList(),
          prefetchHooksCallback: null,
        ),
      );
}

typedef $$RoutineItemsTableProcessedTableManager =
    ProcessedTableManager<
      _$AppDatabase,
      $RoutineItemsTable,
      RoutineItem,
      $$RoutineItemsTableFilterComposer,
      $$RoutineItemsTableOrderingComposer,
      $$RoutineItemsTableAnnotationComposer,
      $$RoutineItemsTableCreateCompanionBuilder,
      $$RoutineItemsTableUpdateCompanionBuilder,
      (
        RoutineItem,
        BaseReferences<_$AppDatabase, $RoutineItemsTable, RoutineItem>,
      ),
      RoutineItem,
      PrefetchHooks Function()
    >;
typedef $$RoutineCompletionsTableCreateCompanionBuilder =
    RoutineCompletionsCompanion Function({
      required String completionId,
      required String routineId,
      required String userId,
      required String completedDate,
      Value<DateTime> completedAt,
      Value<int> rowid,
    });
typedef $$RoutineCompletionsTableUpdateCompanionBuilder =
    RoutineCompletionsCompanion Function({
      Value<String> completionId,
      Value<String> routineId,
      Value<String> userId,
      Value<String> completedDate,
      Value<DateTime> completedAt,
      Value<int> rowid,
    });

class $$RoutineCompletionsTableFilterComposer
    extends Composer<_$AppDatabase, $RoutineCompletionsTable> {
  $$RoutineCompletionsTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get completionId => $composableBuilder(
    column: $table.completionId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get routineId => $composableBuilder(
    column: $table.routineId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get userId => $composableBuilder(
    column: $table.userId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get completedDate => $composableBuilder(
    column: $table.completedDate,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<DateTime> get completedAt => $composableBuilder(
    column: $table.completedAt,
    builder: (column) => ColumnFilters(column),
  );
}

class $$RoutineCompletionsTableOrderingComposer
    extends Composer<_$AppDatabase, $RoutineCompletionsTable> {
  $$RoutineCompletionsTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get completionId => $composableBuilder(
    column: $table.completionId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get routineId => $composableBuilder(
    column: $table.routineId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get userId => $composableBuilder(
    column: $table.userId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get completedDate => $composableBuilder(
    column: $table.completedDate,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<DateTime> get completedAt => $composableBuilder(
    column: $table.completedAt,
    builder: (column) => ColumnOrderings(column),
  );
}

class $$RoutineCompletionsTableAnnotationComposer
    extends Composer<_$AppDatabase, $RoutineCompletionsTable> {
  $$RoutineCompletionsTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get completionId => $composableBuilder(
    column: $table.completionId,
    builder: (column) => column,
  );

  GeneratedColumn<String> get routineId =>
      $composableBuilder(column: $table.routineId, builder: (column) => column);

  GeneratedColumn<String> get userId =>
      $composableBuilder(column: $table.userId, builder: (column) => column);

  GeneratedColumn<String> get completedDate => $composableBuilder(
    column: $table.completedDate,
    builder: (column) => column,
  );

  GeneratedColumn<DateTime> get completedAt => $composableBuilder(
    column: $table.completedAt,
    builder: (column) => column,
  );
}

class $$RoutineCompletionsTableTableManager
    extends
        RootTableManager<
          _$AppDatabase,
          $RoutineCompletionsTable,
          RoutineCompletion,
          $$RoutineCompletionsTableFilterComposer,
          $$RoutineCompletionsTableOrderingComposer,
          $$RoutineCompletionsTableAnnotationComposer,
          $$RoutineCompletionsTableCreateCompanionBuilder,
          $$RoutineCompletionsTableUpdateCompanionBuilder,
          (
            RoutineCompletion,
            BaseReferences<
              _$AppDatabase,
              $RoutineCompletionsTable,
              RoutineCompletion
            >,
          ),
          RoutineCompletion,
          PrefetchHooks Function()
        > {
  $$RoutineCompletionsTableTableManager(
    _$AppDatabase db,
    $RoutineCompletionsTable table,
  ) : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$RoutineCompletionsTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$RoutineCompletionsTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$RoutineCompletionsTableAnnotationComposer(
                $db: db,
                $table: table,
              ),
          updateCompanionCallback:
              ({
                Value<String> completionId = const Value.absent(),
                Value<String> routineId = const Value.absent(),
                Value<String> userId = const Value.absent(),
                Value<String> completedDate = const Value.absent(),
                Value<DateTime> completedAt = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => RoutineCompletionsCompanion(
                completionId: completionId,
                routineId: routineId,
                userId: userId,
                completedDate: completedDate,
                completedAt: completedAt,
                rowid: rowid,
              ),
          createCompanionCallback:
              ({
                required String completionId,
                required String routineId,
                required String userId,
                required String completedDate,
                Value<DateTime> completedAt = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => RoutineCompletionsCompanion.insert(
                completionId: completionId,
                routineId: routineId,
                userId: userId,
                completedDate: completedDate,
                completedAt: completedAt,
                rowid: rowid,
              ),
          withReferenceMapper: (p0) => p0
              .map((e) => (e.readTable(table), BaseReferences(db, table, e)))
              .toList(),
          prefetchHooksCallback: null,
        ),
      );
}

typedef $$RoutineCompletionsTableProcessedTableManager =
    ProcessedTableManager<
      _$AppDatabase,
      $RoutineCompletionsTable,
      RoutineCompletion,
      $$RoutineCompletionsTableFilterComposer,
      $$RoutineCompletionsTableOrderingComposer,
      $$RoutineCompletionsTableAnnotationComposer,
      $$RoutineCompletionsTableCreateCompanionBuilder,
      $$RoutineCompletionsTableUpdateCompanionBuilder,
      (
        RoutineCompletion,
        BaseReferences<
          _$AppDatabase,
          $RoutineCompletionsTable,
          RoutineCompletion
        >,
      ),
      RoutineCompletion,
      PrefetchHooks Function()
    >;
typedef $$FashionRecordsTableCreateCompanionBuilder =
    FashionRecordsCompanion Function({
      required String fashionId,
      required String userId,
      Value<String?> photoPath,
      Value<String?> llmAnalysis,
      Value<String?> weatherSummary,
      Value<String?> memo,
      Value<DateTime> recordedAt,
      Value<DateTime> createdAt,
      Value<int> rowid,
    });
typedef $$FashionRecordsTableUpdateCompanionBuilder =
    FashionRecordsCompanion Function({
      Value<String> fashionId,
      Value<String> userId,
      Value<String?> photoPath,
      Value<String?> llmAnalysis,
      Value<String?> weatherSummary,
      Value<String?> memo,
      Value<DateTime> recordedAt,
      Value<DateTime> createdAt,
      Value<int> rowid,
    });

class $$FashionRecordsTableFilterComposer
    extends Composer<_$AppDatabase, $FashionRecordsTable> {
  $$FashionRecordsTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get fashionId => $composableBuilder(
    column: $table.fashionId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get userId => $composableBuilder(
    column: $table.userId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get photoPath => $composableBuilder(
    column: $table.photoPath,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get llmAnalysis => $composableBuilder(
    column: $table.llmAnalysis,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get weatherSummary => $composableBuilder(
    column: $table.weatherSummary,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get memo => $composableBuilder(
    column: $table.memo,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<DateTime> get recordedAt => $composableBuilder(
    column: $table.recordedAt,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<DateTime> get createdAt => $composableBuilder(
    column: $table.createdAt,
    builder: (column) => ColumnFilters(column),
  );
}

class $$FashionRecordsTableOrderingComposer
    extends Composer<_$AppDatabase, $FashionRecordsTable> {
  $$FashionRecordsTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get fashionId => $composableBuilder(
    column: $table.fashionId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get userId => $composableBuilder(
    column: $table.userId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get photoPath => $composableBuilder(
    column: $table.photoPath,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get llmAnalysis => $composableBuilder(
    column: $table.llmAnalysis,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get weatherSummary => $composableBuilder(
    column: $table.weatherSummary,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get memo => $composableBuilder(
    column: $table.memo,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<DateTime> get recordedAt => $composableBuilder(
    column: $table.recordedAt,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<DateTime> get createdAt => $composableBuilder(
    column: $table.createdAt,
    builder: (column) => ColumnOrderings(column),
  );
}

class $$FashionRecordsTableAnnotationComposer
    extends Composer<_$AppDatabase, $FashionRecordsTable> {
  $$FashionRecordsTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get fashionId =>
      $composableBuilder(column: $table.fashionId, builder: (column) => column);

  GeneratedColumn<String> get userId =>
      $composableBuilder(column: $table.userId, builder: (column) => column);

  GeneratedColumn<String> get photoPath =>
      $composableBuilder(column: $table.photoPath, builder: (column) => column);

  GeneratedColumn<String> get llmAnalysis => $composableBuilder(
    column: $table.llmAnalysis,
    builder: (column) => column,
  );

  GeneratedColumn<String> get weatherSummary => $composableBuilder(
    column: $table.weatherSummary,
    builder: (column) => column,
  );

  GeneratedColumn<String> get memo =>
      $composableBuilder(column: $table.memo, builder: (column) => column);

  GeneratedColumn<DateTime> get recordedAt => $composableBuilder(
    column: $table.recordedAt,
    builder: (column) => column,
  );

  GeneratedColumn<DateTime> get createdAt =>
      $composableBuilder(column: $table.createdAt, builder: (column) => column);
}

class $$FashionRecordsTableTableManager
    extends
        RootTableManager<
          _$AppDatabase,
          $FashionRecordsTable,
          FashionRecord,
          $$FashionRecordsTableFilterComposer,
          $$FashionRecordsTableOrderingComposer,
          $$FashionRecordsTableAnnotationComposer,
          $$FashionRecordsTableCreateCompanionBuilder,
          $$FashionRecordsTableUpdateCompanionBuilder,
          (
            FashionRecord,
            BaseReferences<_$AppDatabase, $FashionRecordsTable, FashionRecord>,
          ),
          FashionRecord,
          PrefetchHooks Function()
        > {
  $$FashionRecordsTableTableManager(
    _$AppDatabase db,
    $FashionRecordsTable table,
  ) : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$FashionRecordsTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$FashionRecordsTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$FashionRecordsTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback:
              ({
                Value<String> fashionId = const Value.absent(),
                Value<String> userId = const Value.absent(),
                Value<String?> photoPath = const Value.absent(),
                Value<String?> llmAnalysis = const Value.absent(),
                Value<String?> weatherSummary = const Value.absent(),
                Value<String?> memo = const Value.absent(),
                Value<DateTime> recordedAt = const Value.absent(),
                Value<DateTime> createdAt = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => FashionRecordsCompanion(
                fashionId: fashionId,
                userId: userId,
                photoPath: photoPath,
                llmAnalysis: llmAnalysis,
                weatherSummary: weatherSummary,
                memo: memo,
                recordedAt: recordedAt,
                createdAt: createdAt,
                rowid: rowid,
              ),
          createCompanionCallback:
              ({
                required String fashionId,
                required String userId,
                Value<String?> photoPath = const Value.absent(),
                Value<String?> llmAnalysis = const Value.absent(),
                Value<String?> weatherSummary = const Value.absent(),
                Value<String?> memo = const Value.absent(),
                Value<DateTime> recordedAt = const Value.absent(),
                Value<DateTime> createdAt = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => FashionRecordsCompanion.insert(
                fashionId: fashionId,
                userId: userId,
                photoPath: photoPath,
                llmAnalysis: llmAnalysis,
                weatherSummary: weatherSummary,
                memo: memo,
                recordedAt: recordedAt,
                createdAt: createdAt,
                rowid: rowid,
              ),
          withReferenceMapper: (p0) => p0
              .map((e) => (e.readTable(table), BaseReferences(db, table, e)))
              .toList(),
          prefetchHooksCallback: null,
        ),
      );
}

typedef $$FashionRecordsTableProcessedTableManager =
    ProcessedTableManager<
      _$AppDatabase,
      $FashionRecordsTable,
      FashionRecord,
      $$FashionRecordsTableFilterComposer,
      $$FashionRecordsTableOrderingComposer,
      $$FashionRecordsTableAnnotationComposer,
      $$FashionRecordsTableCreateCompanionBuilder,
      $$FashionRecordsTableUpdateCompanionBuilder,
      (
        FashionRecord,
        BaseReferences<_$AppDatabase, $FashionRecordsTable, FashionRecord>,
      ),
      FashionRecord,
      PrefetchHooks Function()
    >;
typedef $$PrepareItemsTableCreateCompanionBuilder =
    PrepareItemsCompanion Function({
      required String prepareId,
      required String userId,
      required String targetDate,
      required String title,
      required String itemsJson,
      Value<bool> isNotified,
      Value<DateTime> createdAt,
      Value<int> rowid,
    });
typedef $$PrepareItemsTableUpdateCompanionBuilder =
    PrepareItemsCompanion Function({
      Value<String> prepareId,
      Value<String> userId,
      Value<String> targetDate,
      Value<String> title,
      Value<String> itemsJson,
      Value<bool> isNotified,
      Value<DateTime> createdAt,
      Value<int> rowid,
    });

class $$PrepareItemsTableFilterComposer
    extends Composer<_$AppDatabase, $PrepareItemsTable> {
  $$PrepareItemsTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get prepareId => $composableBuilder(
    column: $table.prepareId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get userId => $composableBuilder(
    column: $table.userId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get targetDate => $composableBuilder(
    column: $table.targetDate,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get title => $composableBuilder(
    column: $table.title,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get itemsJson => $composableBuilder(
    column: $table.itemsJson,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<bool> get isNotified => $composableBuilder(
    column: $table.isNotified,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<DateTime> get createdAt => $composableBuilder(
    column: $table.createdAt,
    builder: (column) => ColumnFilters(column),
  );
}

class $$PrepareItemsTableOrderingComposer
    extends Composer<_$AppDatabase, $PrepareItemsTable> {
  $$PrepareItemsTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get prepareId => $composableBuilder(
    column: $table.prepareId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get userId => $composableBuilder(
    column: $table.userId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get targetDate => $composableBuilder(
    column: $table.targetDate,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get title => $composableBuilder(
    column: $table.title,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get itemsJson => $composableBuilder(
    column: $table.itemsJson,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<bool> get isNotified => $composableBuilder(
    column: $table.isNotified,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<DateTime> get createdAt => $composableBuilder(
    column: $table.createdAt,
    builder: (column) => ColumnOrderings(column),
  );
}

class $$PrepareItemsTableAnnotationComposer
    extends Composer<_$AppDatabase, $PrepareItemsTable> {
  $$PrepareItemsTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get prepareId =>
      $composableBuilder(column: $table.prepareId, builder: (column) => column);

  GeneratedColumn<String> get userId =>
      $composableBuilder(column: $table.userId, builder: (column) => column);

  GeneratedColumn<String> get targetDate => $composableBuilder(
    column: $table.targetDate,
    builder: (column) => column,
  );

  GeneratedColumn<String> get title =>
      $composableBuilder(column: $table.title, builder: (column) => column);

  GeneratedColumn<String> get itemsJson =>
      $composableBuilder(column: $table.itemsJson, builder: (column) => column);

  GeneratedColumn<bool> get isNotified => $composableBuilder(
    column: $table.isNotified,
    builder: (column) => column,
  );

  GeneratedColumn<DateTime> get createdAt =>
      $composableBuilder(column: $table.createdAt, builder: (column) => column);
}

class $$PrepareItemsTableTableManager
    extends
        RootTableManager<
          _$AppDatabase,
          $PrepareItemsTable,
          PrepareItem,
          $$PrepareItemsTableFilterComposer,
          $$PrepareItemsTableOrderingComposer,
          $$PrepareItemsTableAnnotationComposer,
          $$PrepareItemsTableCreateCompanionBuilder,
          $$PrepareItemsTableUpdateCompanionBuilder,
          (
            PrepareItem,
            BaseReferences<_$AppDatabase, $PrepareItemsTable, PrepareItem>,
          ),
          PrepareItem,
          PrefetchHooks Function()
        > {
  $$PrepareItemsTableTableManager(_$AppDatabase db, $PrepareItemsTable table)
    : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$PrepareItemsTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$PrepareItemsTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$PrepareItemsTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback:
              ({
                Value<String> prepareId = const Value.absent(),
                Value<String> userId = const Value.absent(),
                Value<String> targetDate = const Value.absent(),
                Value<String> title = const Value.absent(),
                Value<String> itemsJson = const Value.absent(),
                Value<bool> isNotified = const Value.absent(),
                Value<DateTime> createdAt = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => PrepareItemsCompanion(
                prepareId: prepareId,
                userId: userId,
                targetDate: targetDate,
                title: title,
                itemsJson: itemsJson,
                isNotified: isNotified,
                createdAt: createdAt,
                rowid: rowid,
              ),
          createCompanionCallback:
              ({
                required String prepareId,
                required String userId,
                required String targetDate,
                required String title,
                required String itemsJson,
                Value<bool> isNotified = const Value.absent(),
                Value<DateTime> createdAt = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => PrepareItemsCompanion.insert(
                prepareId: prepareId,
                userId: userId,
                targetDate: targetDate,
                title: title,
                itemsJson: itemsJson,
                isNotified: isNotified,
                createdAt: createdAt,
                rowid: rowid,
              ),
          withReferenceMapper: (p0) => p0
              .map((e) => (e.readTable(table), BaseReferences(db, table, e)))
              .toList(),
          prefetchHooksCallback: null,
        ),
      );
}

typedef $$PrepareItemsTableProcessedTableManager =
    ProcessedTableManager<
      _$AppDatabase,
      $PrepareItemsTable,
      PrepareItem,
      $$PrepareItemsTableFilterComposer,
      $$PrepareItemsTableOrderingComposer,
      $$PrepareItemsTableAnnotationComposer,
      $$PrepareItemsTableCreateCompanionBuilder,
      $$PrepareItemsTableUpdateCompanionBuilder,
      (
        PrepareItem,
        BaseReferences<_$AppDatabase, $PrepareItemsTable, PrepareItem>,
      ),
      PrepareItem,
      PrefetchHooks Function()
    >;
typedef $$SubscriptionItemsTableCreateCompanionBuilder =
    SubscriptionItemsCompanion Function({
      required String subscriptionId,
      required String userId,
      required String name,
      required int amount,
      Value<String> cycle,
      required int billingDay,
      Value<int?> alertDaysBefore,
      Value<String?> category,
      Value<bool> isActive,
      Value<DateTime?> lastBilledDate,
      Value<DateTime> createdAt,
      Value<int> rowid,
    });
typedef $$SubscriptionItemsTableUpdateCompanionBuilder =
    SubscriptionItemsCompanion Function({
      Value<String> subscriptionId,
      Value<String> userId,
      Value<String> name,
      Value<int> amount,
      Value<String> cycle,
      Value<int> billingDay,
      Value<int?> alertDaysBefore,
      Value<String?> category,
      Value<bool> isActive,
      Value<DateTime?> lastBilledDate,
      Value<DateTime> createdAt,
      Value<int> rowid,
    });

class $$SubscriptionItemsTableFilterComposer
    extends Composer<_$AppDatabase, $SubscriptionItemsTable> {
  $$SubscriptionItemsTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get subscriptionId => $composableBuilder(
    column: $table.subscriptionId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get userId => $composableBuilder(
    column: $table.userId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get name => $composableBuilder(
    column: $table.name,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get amount => $composableBuilder(
    column: $table.amount,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get cycle => $composableBuilder(
    column: $table.cycle,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get billingDay => $composableBuilder(
    column: $table.billingDay,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get alertDaysBefore => $composableBuilder(
    column: $table.alertDaysBefore,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get category => $composableBuilder(
    column: $table.category,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<bool> get isActive => $composableBuilder(
    column: $table.isActive,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<DateTime> get lastBilledDate => $composableBuilder(
    column: $table.lastBilledDate,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<DateTime> get createdAt => $composableBuilder(
    column: $table.createdAt,
    builder: (column) => ColumnFilters(column),
  );
}

class $$SubscriptionItemsTableOrderingComposer
    extends Composer<_$AppDatabase, $SubscriptionItemsTable> {
  $$SubscriptionItemsTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get subscriptionId => $composableBuilder(
    column: $table.subscriptionId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get userId => $composableBuilder(
    column: $table.userId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get name => $composableBuilder(
    column: $table.name,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get amount => $composableBuilder(
    column: $table.amount,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get cycle => $composableBuilder(
    column: $table.cycle,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get billingDay => $composableBuilder(
    column: $table.billingDay,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get alertDaysBefore => $composableBuilder(
    column: $table.alertDaysBefore,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get category => $composableBuilder(
    column: $table.category,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<bool> get isActive => $composableBuilder(
    column: $table.isActive,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<DateTime> get lastBilledDate => $composableBuilder(
    column: $table.lastBilledDate,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<DateTime> get createdAt => $composableBuilder(
    column: $table.createdAt,
    builder: (column) => ColumnOrderings(column),
  );
}

class $$SubscriptionItemsTableAnnotationComposer
    extends Composer<_$AppDatabase, $SubscriptionItemsTable> {
  $$SubscriptionItemsTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get subscriptionId => $composableBuilder(
    column: $table.subscriptionId,
    builder: (column) => column,
  );

  GeneratedColumn<String> get userId =>
      $composableBuilder(column: $table.userId, builder: (column) => column);

  GeneratedColumn<String> get name =>
      $composableBuilder(column: $table.name, builder: (column) => column);

  GeneratedColumn<int> get amount =>
      $composableBuilder(column: $table.amount, builder: (column) => column);

  GeneratedColumn<String> get cycle =>
      $composableBuilder(column: $table.cycle, builder: (column) => column);

  GeneratedColumn<int> get billingDay => $composableBuilder(
    column: $table.billingDay,
    builder: (column) => column,
  );

  GeneratedColumn<int> get alertDaysBefore => $composableBuilder(
    column: $table.alertDaysBefore,
    builder: (column) => column,
  );

  GeneratedColumn<String> get category =>
      $composableBuilder(column: $table.category, builder: (column) => column);

  GeneratedColumn<bool> get isActive =>
      $composableBuilder(column: $table.isActive, builder: (column) => column);

  GeneratedColumn<DateTime> get lastBilledDate => $composableBuilder(
    column: $table.lastBilledDate,
    builder: (column) => column,
  );

  GeneratedColumn<DateTime> get createdAt =>
      $composableBuilder(column: $table.createdAt, builder: (column) => column);
}

class $$SubscriptionItemsTableTableManager
    extends
        RootTableManager<
          _$AppDatabase,
          $SubscriptionItemsTable,
          SubscriptionItem,
          $$SubscriptionItemsTableFilterComposer,
          $$SubscriptionItemsTableOrderingComposer,
          $$SubscriptionItemsTableAnnotationComposer,
          $$SubscriptionItemsTableCreateCompanionBuilder,
          $$SubscriptionItemsTableUpdateCompanionBuilder,
          (
            SubscriptionItem,
            BaseReferences<
              _$AppDatabase,
              $SubscriptionItemsTable,
              SubscriptionItem
            >,
          ),
          SubscriptionItem,
          PrefetchHooks Function()
        > {
  $$SubscriptionItemsTableTableManager(
    _$AppDatabase db,
    $SubscriptionItemsTable table,
  ) : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$SubscriptionItemsTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$SubscriptionItemsTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$SubscriptionItemsTableAnnotationComposer(
                $db: db,
                $table: table,
              ),
          updateCompanionCallback:
              ({
                Value<String> subscriptionId = const Value.absent(),
                Value<String> userId = const Value.absent(),
                Value<String> name = const Value.absent(),
                Value<int> amount = const Value.absent(),
                Value<String> cycle = const Value.absent(),
                Value<int> billingDay = const Value.absent(),
                Value<int?> alertDaysBefore = const Value.absent(),
                Value<String?> category = const Value.absent(),
                Value<bool> isActive = const Value.absent(),
                Value<DateTime?> lastBilledDate = const Value.absent(),
                Value<DateTime> createdAt = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => SubscriptionItemsCompanion(
                subscriptionId: subscriptionId,
                userId: userId,
                name: name,
                amount: amount,
                cycle: cycle,
                billingDay: billingDay,
                alertDaysBefore: alertDaysBefore,
                category: category,
                isActive: isActive,
                lastBilledDate: lastBilledDate,
                createdAt: createdAt,
                rowid: rowid,
              ),
          createCompanionCallback:
              ({
                required String subscriptionId,
                required String userId,
                required String name,
                required int amount,
                Value<String> cycle = const Value.absent(),
                required int billingDay,
                Value<int?> alertDaysBefore = const Value.absent(),
                Value<String?> category = const Value.absent(),
                Value<bool> isActive = const Value.absent(),
                Value<DateTime?> lastBilledDate = const Value.absent(),
                Value<DateTime> createdAt = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => SubscriptionItemsCompanion.insert(
                subscriptionId: subscriptionId,
                userId: userId,
                name: name,
                amount: amount,
                cycle: cycle,
                billingDay: billingDay,
                alertDaysBefore: alertDaysBefore,
                category: category,
                isActive: isActive,
                lastBilledDate: lastBilledDate,
                createdAt: createdAt,
                rowid: rowid,
              ),
          withReferenceMapper: (p0) => p0
              .map((e) => (e.readTable(table), BaseReferences(db, table, e)))
              .toList(),
          prefetchHooksCallback: null,
        ),
      );
}

typedef $$SubscriptionItemsTableProcessedTableManager =
    ProcessedTableManager<
      _$AppDatabase,
      $SubscriptionItemsTable,
      SubscriptionItem,
      $$SubscriptionItemsTableFilterComposer,
      $$SubscriptionItemsTableOrderingComposer,
      $$SubscriptionItemsTableAnnotationComposer,
      $$SubscriptionItemsTableCreateCompanionBuilder,
      $$SubscriptionItemsTableUpdateCompanionBuilder,
      (
        SubscriptionItem,
        BaseReferences<
          _$AppDatabase,
          $SubscriptionItemsTable,
          SubscriptionItem
        >,
      ),
      SubscriptionItem,
      PrefetchHooks Function()
    >;
typedef $$CaptureItemsTableCreateCompanionBuilder =
    CaptureItemsCompanion Function({
      required String captureId,
      required String userId,
      required String sourceType,
      Value<String?> rawText,
      Value<String?> assetUri,
      Value<String> status,
      Value<DateTime> createdAt,
      Value<int> rowid,
    });
typedef $$CaptureItemsTableUpdateCompanionBuilder =
    CaptureItemsCompanion Function({
      Value<String> captureId,
      Value<String> userId,
      Value<String> sourceType,
      Value<String?> rawText,
      Value<String?> assetUri,
      Value<String> status,
      Value<DateTime> createdAt,
      Value<int> rowid,
    });

class $$CaptureItemsTableFilterComposer
    extends Composer<_$AppDatabase, $CaptureItemsTable> {
  $$CaptureItemsTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get captureId => $composableBuilder(
    column: $table.captureId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get userId => $composableBuilder(
    column: $table.userId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get sourceType => $composableBuilder(
    column: $table.sourceType,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get rawText => $composableBuilder(
    column: $table.rawText,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get assetUri => $composableBuilder(
    column: $table.assetUri,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get status => $composableBuilder(
    column: $table.status,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<DateTime> get createdAt => $composableBuilder(
    column: $table.createdAt,
    builder: (column) => ColumnFilters(column),
  );
}

class $$CaptureItemsTableOrderingComposer
    extends Composer<_$AppDatabase, $CaptureItemsTable> {
  $$CaptureItemsTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get captureId => $composableBuilder(
    column: $table.captureId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get userId => $composableBuilder(
    column: $table.userId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get sourceType => $composableBuilder(
    column: $table.sourceType,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get rawText => $composableBuilder(
    column: $table.rawText,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get assetUri => $composableBuilder(
    column: $table.assetUri,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get status => $composableBuilder(
    column: $table.status,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<DateTime> get createdAt => $composableBuilder(
    column: $table.createdAt,
    builder: (column) => ColumnOrderings(column),
  );
}

class $$CaptureItemsTableAnnotationComposer
    extends Composer<_$AppDatabase, $CaptureItemsTable> {
  $$CaptureItemsTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get captureId =>
      $composableBuilder(column: $table.captureId, builder: (column) => column);

  GeneratedColumn<String> get userId =>
      $composableBuilder(column: $table.userId, builder: (column) => column);

  GeneratedColumn<String> get sourceType => $composableBuilder(
    column: $table.sourceType,
    builder: (column) => column,
  );

  GeneratedColumn<String> get rawText =>
      $composableBuilder(column: $table.rawText, builder: (column) => column);

  GeneratedColumn<String> get assetUri =>
      $composableBuilder(column: $table.assetUri, builder: (column) => column);

  GeneratedColumn<String> get status =>
      $composableBuilder(column: $table.status, builder: (column) => column);

  GeneratedColumn<DateTime> get createdAt =>
      $composableBuilder(column: $table.createdAt, builder: (column) => column);
}

class $$CaptureItemsTableTableManager
    extends
        RootTableManager<
          _$AppDatabase,
          $CaptureItemsTable,
          CaptureItem,
          $$CaptureItemsTableFilterComposer,
          $$CaptureItemsTableOrderingComposer,
          $$CaptureItemsTableAnnotationComposer,
          $$CaptureItemsTableCreateCompanionBuilder,
          $$CaptureItemsTableUpdateCompanionBuilder,
          (
            CaptureItem,
            BaseReferences<_$AppDatabase, $CaptureItemsTable, CaptureItem>,
          ),
          CaptureItem,
          PrefetchHooks Function()
        > {
  $$CaptureItemsTableTableManager(_$AppDatabase db, $CaptureItemsTable table)
    : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$CaptureItemsTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$CaptureItemsTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$CaptureItemsTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback:
              ({
                Value<String> captureId = const Value.absent(),
                Value<String> userId = const Value.absent(),
                Value<String> sourceType = const Value.absent(),
                Value<String?> rawText = const Value.absent(),
                Value<String?> assetUri = const Value.absent(),
                Value<String> status = const Value.absent(),
                Value<DateTime> createdAt = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => CaptureItemsCompanion(
                captureId: captureId,
                userId: userId,
                sourceType: sourceType,
                rawText: rawText,
                assetUri: assetUri,
                status: status,
                createdAt: createdAt,
                rowid: rowid,
              ),
          createCompanionCallback:
              ({
                required String captureId,
                required String userId,
                required String sourceType,
                Value<String?> rawText = const Value.absent(),
                Value<String?> assetUri = const Value.absent(),
                Value<String> status = const Value.absent(),
                Value<DateTime> createdAt = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => CaptureItemsCompanion.insert(
                captureId: captureId,
                userId: userId,
                sourceType: sourceType,
                rawText: rawText,
                assetUri: assetUri,
                status: status,
                createdAt: createdAt,
                rowid: rowid,
              ),
          withReferenceMapper: (p0) => p0
              .map((e) => (e.readTable(table), BaseReferences(db, table, e)))
              .toList(),
          prefetchHooksCallback: null,
        ),
      );
}

typedef $$CaptureItemsTableProcessedTableManager =
    ProcessedTableManager<
      _$AppDatabase,
      $CaptureItemsTable,
      CaptureItem,
      $$CaptureItemsTableFilterComposer,
      $$CaptureItemsTableOrderingComposer,
      $$CaptureItemsTableAnnotationComposer,
      $$CaptureItemsTableCreateCompanionBuilder,
      $$CaptureItemsTableUpdateCompanionBuilder,
      (
        CaptureItem,
        BaseReferences<_$AppDatabase, $CaptureItemsTable, CaptureItem>,
      ),
      CaptureItem,
      PrefetchHooks Function()
    >;
typedef $$ExtractedCapturesTableCreateCompanionBuilder =
    ExtractedCapturesCompanion Function({
      required String extractedId,
      required String captureId,
      required String domain,
      Value<String?> entitiesJson,
      required double confidence,
      Value<bool> committed,
      Value<DateTime> createdAt,
      Value<int> rowid,
    });
typedef $$ExtractedCapturesTableUpdateCompanionBuilder =
    ExtractedCapturesCompanion Function({
      Value<String> extractedId,
      Value<String> captureId,
      Value<String> domain,
      Value<String?> entitiesJson,
      Value<double> confidence,
      Value<bool> committed,
      Value<DateTime> createdAt,
      Value<int> rowid,
    });

class $$ExtractedCapturesTableFilterComposer
    extends Composer<_$AppDatabase, $ExtractedCapturesTable> {
  $$ExtractedCapturesTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get extractedId => $composableBuilder(
    column: $table.extractedId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get captureId => $composableBuilder(
    column: $table.captureId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get domain => $composableBuilder(
    column: $table.domain,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get entitiesJson => $composableBuilder(
    column: $table.entitiesJson,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<double> get confidence => $composableBuilder(
    column: $table.confidence,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<bool> get committed => $composableBuilder(
    column: $table.committed,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<DateTime> get createdAt => $composableBuilder(
    column: $table.createdAt,
    builder: (column) => ColumnFilters(column),
  );
}

class $$ExtractedCapturesTableOrderingComposer
    extends Composer<_$AppDatabase, $ExtractedCapturesTable> {
  $$ExtractedCapturesTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get extractedId => $composableBuilder(
    column: $table.extractedId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get captureId => $composableBuilder(
    column: $table.captureId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get domain => $composableBuilder(
    column: $table.domain,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get entitiesJson => $composableBuilder(
    column: $table.entitiesJson,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<double> get confidence => $composableBuilder(
    column: $table.confidence,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<bool> get committed => $composableBuilder(
    column: $table.committed,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<DateTime> get createdAt => $composableBuilder(
    column: $table.createdAt,
    builder: (column) => ColumnOrderings(column),
  );
}

class $$ExtractedCapturesTableAnnotationComposer
    extends Composer<_$AppDatabase, $ExtractedCapturesTable> {
  $$ExtractedCapturesTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get extractedId => $composableBuilder(
    column: $table.extractedId,
    builder: (column) => column,
  );

  GeneratedColumn<String> get captureId =>
      $composableBuilder(column: $table.captureId, builder: (column) => column);

  GeneratedColumn<String> get domain =>
      $composableBuilder(column: $table.domain, builder: (column) => column);

  GeneratedColumn<String> get entitiesJson => $composableBuilder(
    column: $table.entitiesJson,
    builder: (column) => column,
  );

  GeneratedColumn<double> get confidence => $composableBuilder(
    column: $table.confidence,
    builder: (column) => column,
  );

  GeneratedColumn<bool> get committed =>
      $composableBuilder(column: $table.committed, builder: (column) => column);

  GeneratedColumn<DateTime> get createdAt =>
      $composableBuilder(column: $table.createdAt, builder: (column) => column);
}

class $$ExtractedCapturesTableTableManager
    extends
        RootTableManager<
          _$AppDatabase,
          $ExtractedCapturesTable,
          ExtractedCapture,
          $$ExtractedCapturesTableFilterComposer,
          $$ExtractedCapturesTableOrderingComposer,
          $$ExtractedCapturesTableAnnotationComposer,
          $$ExtractedCapturesTableCreateCompanionBuilder,
          $$ExtractedCapturesTableUpdateCompanionBuilder,
          (
            ExtractedCapture,
            BaseReferences<
              _$AppDatabase,
              $ExtractedCapturesTable,
              ExtractedCapture
            >,
          ),
          ExtractedCapture,
          PrefetchHooks Function()
        > {
  $$ExtractedCapturesTableTableManager(
    _$AppDatabase db,
    $ExtractedCapturesTable table,
  ) : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$ExtractedCapturesTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$ExtractedCapturesTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$ExtractedCapturesTableAnnotationComposer(
                $db: db,
                $table: table,
              ),
          updateCompanionCallback:
              ({
                Value<String> extractedId = const Value.absent(),
                Value<String> captureId = const Value.absent(),
                Value<String> domain = const Value.absent(),
                Value<String?> entitiesJson = const Value.absent(),
                Value<double> confidence = const Value.absent(),
                Value<bool> committed = const Value.absent(),
                Value<DateTime> createdAt = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => ExtractedCapturesCompanion(
                extractedId: extractedId,
                captureId: captureId,
                domain: domain,
                entitiesJson: entitiesJson,
                confidence: confidence,
                committed: committed,
                createdAt: createdAt,
                rowid: rowid,
              ),
          createCompanionCallback:
              ({
                required String extractedId,
                required String captureId,
                required String domain,
                Value<String?> entitiesJson = const Value.absent(),
                required double confidence,
                Value<bool> committed = const Value.absent(),
                Value<DateTime> createdAt = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => ExtractedCapturesCompanion.insert(
                extractedId: extractedId,
                captureId: captureId,
                domain: domain,
                entitiesJson: entitiesJson,
                confidence: confidence,
                committed: committed,
                createdAt: createdAt,
                rowid: rowid,
              ),
          withReferenceMapper: (p0) => p0
              .map((e) => (e.readTable(table), BaseReferences(db, table, e)))
              .toList(),
          prefetchHooksCallback: null,
        ),
      );
}

typedef $$ExtractedCapturesTableProcessedTableManager =
    ProcessedTableManager<
      _$AppDatabase,
      $ExtractedCapturesTable,
      ExtractedCapture,
      $$ExtractedCapturesTableFilterComposer,
      $$ExtractedCapturesTableOrderingComposer,
      $$ExtractedCapturesTableAnnotationComposer,
      $$ExtractedCapturesTableCreateCompanionBuilder,
      $$ExtractedCapturesTableUpdateCompanionBuilder,
      (
        ExtractedCapture,
        BaseReferences<
          _$AppDatabase,
          $ExtractedCapturesTable,
          ExtractedCapture
        >,
      ),
      ExtractedCapture,
      PrefetchHooks Function()
    >;
typedef $$TransactionsTableCreateCompanionBuilder =
    TransactionsCompanion Function({
      required String transactionId,
      required String userId,
      Value<String?> extractedId,
      Value<DateTime> occurredAt,
      required String direction,
      required int amount,
      Value<String?> category,
      Value<String?> memo,
      Value<String> source,
      Value<DateTime> createdAt,
      Value<int> rowid,
    });
typedef $$TransactionsTableUpdateCompanionBuilder =
    TransactionsCompanion Function({
      Value<String> transactionId,
      Value<String> userId,
      Value<String?> extractedId,
      Value<DateTime> occurredAt,
      Value<String> direction,
      Value<int> amount,
      Value<String?> category,
      Value<String?> memo,
      Value<String> source,
      Value<DateTime> createdAt,
      Value<int> rowid,
    });

class $$TransactionsTableFilterComposer
    extends Composer<_$AppDatabase, $TransactionsTable> {
  $$TransactionsTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get transactionId => $composableBuilder(
    column: $table.transactionId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get userId => $composableBuilder(
    column: $table.userId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get extractedId => $composableBuilder(
    column: $table.extractedId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<DateTime> get occurredAt => $composableBuilder(
    column: $table.occurredAt,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get direction => $composableBuilder(
    column: $table.direction,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get amount => $composableBuilder(
    column: $table.amount,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get category => $composableBuilder(
    column: $table.category,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get memo => $composableBuilder(
    column: $table.memo,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get source => $composableBuilder(
    column: $table.source,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<DateTime> get createdAt => $composableBuilder(
    column: $table.createdAt,
    builder: (column) => ColumnFilters(column),
  );
}

class $$TransactionsTableOrderingComposer
    extends Composer<_$AppDatabase, $TransactionsTable> {
  $$TransactionsTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get transactionId => $composableBuilder(
    column: $table.transactionId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get userId => $composableBuilder(
    column: $table.userId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get extractedId => $composableBuilder(
    column: $table.extractedId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<DateTime> get occurredAt => $composableBuilder(
    column: $table.occurredAt,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get direction => $composableBuilder(
    column: $table.direction,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get amount => $composableBuilder(
    column: $table.amount,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get category => $composableBuilder(
    column: $table.category,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get memo => $composableBuilder(
    column: $table.memo,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get source => $composableBuilder(
    column: $table.source,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<DateTime> get createdAt => $composableBuilder(
    column: $table.createdAt,
    builder: (column) => ColumnOrderings(column),
  );
}

class $$TransactionsTableAnnotationComposer
    extends Composer<_$AppDatabase, $TransactionsTable> {
  $$TransactionsTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get transactionId => $composableBuilder(
    column: $table.transactionId,
    builder: (column) => column,
  );

  GeneratedColumn<String> get userId =>
      $composableBuilder(column: $table.userId, builder: (column) => column);

  GeneratedColumn<String> get extractedId => $composableBuilder(
    column: $table.extractedId,
    builder: (column) => column,
  );

  GeneratedColumn<DateTime> get occurredAt => $composableBuilder(
    column: $table.occurredAt,
    builder: (column) => column,
  );

  GeneratedColumn<String> get direction =>
      $composableBuilder(column: $table.direction, builder: (column) => column);

  GeneratedColumn<int> get amount =>
      $composableBuilder(column: $table.amount, builder: (column) => column);

  GeneratedColumn<String> get category =>
      $composableBuilder(column: $table.category, builder: (column) => column);

  GeneratedColumn<String> get memo =>
      $composableBuilder(column: $table.memo, builder: (column) => column);

  GeneratedColumn<String> get source =>
      $composableBuilder(column: $table.source, builder: (column) => column);

  GeneratedColumn<DateTime> get createdAt =>
      $composableBuilder(column: $table.createdAt, builder: (column) => column);
}

class $$TransactionsTableTableManager
    extends
        RootTableManager<
          _$AppDatabase,
          $TransactionsTable,
          Transaction,
          $$TransactionsTableFilterComposer,
          $$TransactionsTableOrderingComposer,
          $$TransactionsTableAnnotationComposer,
          $$TransactionsTableCreateCompanionBuilder,
          $$TransactionsTableUpdateCompanionBuilder,
          (
            Transaction,
            BaseReferences<_$AppDatabase, $TransactionsTable, Transaction>,
          ),
          Transaction,
          PrefetchHooks Function()
        > {
  $$TransactionsTableTableManager(_$AppDatabase db, $TransactionsTable table)
    : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$TransactionsTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$TransactionsTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$TransactionsTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback:
              ({
                Value<String> transactionId = const Value.absent(),
                Value<String> userId = const Value.absent(),
                Value<String?> extractedId = const Value.absent(),
                Value<DateTime> occurredAt = const Value.absent(),
                Value<String> direction = const Value.absent(),
                Value<int> amount = const Value.absent(),
                Value<String?> category = const Value.absent(),
                Value<String?> memo = const Value.absent(),
                Value<String> source = const Value.absent(),
                Value<DateTime> createdAt = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => TransactionsCompanion(
                transactionId: transactionId,
                userId: userId,
                extractedId: extractedId,
                occurredAt: occurredAt,
                direction: direction,
                amount: amount,
                category: category,
                memo: memo,
                source: source,
                createdAt: createdAt,
                rowid: rowid,
              ),
          createCompanionCallback:
              ({
                required String transactionId,
                required String userId,
                Value<String?> extractedId = const Value.absent(),
                Value<DateTime> occurredAt = const Value.absent(),
                required String direction,
                required int amount,
                Value<String?> category = const Value.absent(),
                Value<String?> memo = const Value.absent(),
                Value<String> source = const Value.absent(),
                Value<DateTime> createdAt = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => TransactionsCompanion.insert(
                transactionId: transactionId,
                userId: userId,
                extractedId: extractedId,
                occurredAt: occurredAt,
                direction: direction,
                amount: amount,
                category: category,
                memo: memo,
                source: source,
                createdAt: createdAt,
                rowid: rowid,
              ),
          withReferenceMapper: (p0) => p0
              .map((e) => (e.readTable(table), BaseReferences(db, table, e)))
              .toList(),
          prefetchHooksCallback: null,
        ),
      );
}

typedef $$TransactionsTableProcessedTableManager =
    ProcessedTableManager<
      _$AppDatabase,
      $TransactionsTable,
      Transaction,
      $$TransactionsTableFilterComposer,
      $$TransactionsTableOrderingComposer,
      $$TransactionsTableAnnotationComposer,
      $$TransactionsTableCreateCompanionBuilder,
      $$TransactionsTableUpdateCompanionBuilder,
      (
        Transaction,
        BaseReferences<_$AppDatabase, $TransactionsTable, Transaction>,
      ),
      Transaction,
      PrefetchHooks Function()
    >;
typedef $$MemosTableCreateCompanionBuilder =
    MemosCompanion Function({
      required String memoId,
      required String userId,
      required String content,
      Value<String?> tags,
      Value<String> source,
      Value<String?> extractedId,
      Value<DateTime> createdAt,
      Value<DateTime> updatedAt,
      Value<int> rowid,
    });
typedef $$MemosTableUpdateCompanionBuilder =
    MemosCompanion Function({
      Value<String> memoId,
      Value<String> userId,
      Value<String> content,
      Value<String?> tags,
      Value<String> source,
      Value<String?> extractedId,
      Value<DateTime> createdAt,
      Value<DateTime> updatedAt,
      Value<int> rowid,
    });

class $$MemosTableFilterComposer extends Composer<_$AppDatabase, $MemosTable> {
  $$MemosTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get memoId => $composableBuilder(
    column: $table.memoId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get userId => $composableBuilder(
    column: $table.userId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get content => $composableBuilder(
    column: $table.content,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get tags => $composableBuilder(
    column: $table.tags,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get source => $composableBuilder(
    column: $table.source,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get extractedId => $composableBuilder(
    column: $table.extractedId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<DateTime> get createdAt => $composableBuilder(
    column: $table.createdAt,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<DateTime> get updatedAt => $composableBuilder(
    column: $table.updatedAt,
    builder: (column) => ColumnFilters(column),
  );
}

class $$MemosTableOrderingComposer
    extends Composer<_$AppDatabase, $MemosTable> {
  $$MemosTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get memoId => $composableBuilder(
    column: $table.memoId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get userId => $composableBuilder(
    column: $table.userId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get content => $composableBuilder(
    column: $table.content,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get tags => $composableBuilder(
    column: $table.tags,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get source => $composableBuilder(
    column: $table.source,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get extractedId => $composableBuilder(
    column: $table.extractedId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<DateTime> get createdAt => $composableBuilder(
    column: $table.createdAt,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<DateTime> get updatedAt => $composableBuilder(
    column: $table.updatedAt,
    builder: (column) => ColumnOrderings(column),
  );
}

class $$MemosTableAnnotationComposer
    extends Composer<_$AppDatabase, $MemosTable> {
  $$MemosTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get memoId =>
      $composableBuilder(column: $table.memoId, builder: (column) => column);

  GeneratedColumn<String> get userId =>
      $composableBuilder(column: $table.userId, builder: (column) => column);

  GeneratedColumn<String> get content =>
      $composableBuilder(column: $table.content, builder: (column) => column);

  GeneratedColumn<String> get tags =>
      $composableBuilder(column: $table.tags, builder: (column) => column);

  GeneratedColumn<String> get source =>
      $composableBuilder(column: $table.source, builder: (column) => column);

  GeneratedColumn<String> get extractedId => $composableBuilder(
    column: $table.extractedId,
    builder: (column) => column,
  );

  GeneratedColumn<DateTime> get createdAt =>
      $composableBuilder(column: $table.createdAt, builder: (column) => column);

  GeneratedColumn<DateTime> get updatedAt =>
      $composableBuilder(column: $table.updatedAt, builder: (column) => column);
}

class $$MemosTableTableManager
    extends
        RootTableManager<
          _$AppDatabase,
          $MemosTable,
          Memo,
          $$MemosTableFilterComposer,
          $$MemosTableOrderingComposer,
          $$MemosTableAnnotationComposer,
          $$MemosTableCreateCompanionBuilder,
          $$MemosTableUpdateCompanionBuilder,
          (Memo, BaseReferences<_$AppDatabase, $MemosTable, Memo>),
          Memo,
          PrefetchHooks Function()
        > {
  $$MemosTableTableManager(_$AppDatabase db, $MemosTable table)
    : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$MemosTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$MemosTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$MemosTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback:
              ({
                Value<String> memoId = const Value.absent(),
                Value<String> userId = const Value.absent(),
                Value<String> content = const Value.absent(),
                Value<String?> tags = const Value.absent(),
                Value<String> source = const Value.absent(),
                Value<String?> extractedId = const Value.absent(),
                Value<DateTime> createdAt = const Value.absent(),
                Value<DateTime> updatedAt = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => MemosCompanion(
                memoId: memoId,
                userId: userId,
                content: content,
                tags: tags,
                source: source,
                extractedId: extractedId,
                createdAt: createdAt,
                updatedAt: updatedAt,
                rowid: rowid,
              ),
          createCompanionCallback:
              ({
                required String memoId,
                required String userId,
                required String content,
                Value<String?> tags = const Value.absent(),
                Value<String> source = const Value.absent(),
                Value<String?> extractedId = const Value.absent(),
                Value<DateTime> createdAt = const Value.absent(),
                Value<DateTime> updatedAt = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => MemosCompanion.insert(
                memoId: memoId,
                userId: userId,
                content: content,
                tags: tags,
                source: source,
                extractedId: extractedId,
                createdAt: createdAt,
                updatedAt: updatedAt,
                rowid: rowid,
              ),
          withReferenceMapper: (p0) => p0
              .map((e) => (e.readTable(table), BaseReferences(db, table, e)))
              .toList(),
          prefetchHooksCallback: null,
        ),
      );
}

typedef $$MemosTableProcessedTableManager =
    ProcessedTableManager<
      _$AppDatabase,
      $MemosTable,
      Memo,
      $$MemosTableFilterComposer,
      $$MemosTableOrderingComposer,
      $$MemosTableAnnotationComposer,
      $$MemosTableCreateCompanionBuilder,
      $$MemosTableUpdateCompanionBuilder,
      (Memo, BaseReferences<_$AppDatabase, $MemosTable, Memo>),
      Memo,
      PrefetchHooks Function()
    >;
typedef $$BriefingsTableCreateCompanionBuilder =
    BriefingsCompanion Function({
      required String briefingId,
      required String userId,
      required String dateKey,
      Value<String> mustDoJson,
      Value<String> tasksJson,
      Value<String?> advice,
      Value<String?> adviceBasis,
      Value<DateTime> createdAt,
      Value<int> rowid,
    });
typedef $$BriefingsTableUpdateCompanionBuilder =
    BriefingsCompanion Function({
      Value<String> briefingId,
      Value<String> userId,
      Value<String> dateKey,
      Value<String> mustDoJson,
      Value<String> tasksJson,
      Value<String?> advice,
      Value<String?> adviceBasis,
      Value<DateTime> createdAt,
      Value<int> rowid,
    });

class $$BriefingsTableFilterComposer
    extends Composer<_$AppDatabase, $BriefingsTable> {
  $$BriefingsTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get briefingId => $composableBuilder(
    column: $table.briefingId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get userId => $composableBuilder(
    column: $table.userId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get dateKey => $composableBuilder(
    column: $table.dateKey,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get mustDoJson => $composableBuilder(
    column: $table.mustDoJson,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get tasksJson => $composableBuilder(
    column: $table.tasksJson,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get advice => $composableBuilder(
    column: $table.advice,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get adviceBasis => $composableBuilder(
    column: $table.adviceBasis,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<DateTime> get createdAt => $composableBuilder(
    column: $table.createdAt,
    builder: (column) => ColumnFilters(column),
  );
}

class $$BriefingsTableOrderingComposer
    extends Composer<_$AppDatabase, $BriefingsTable> {
  $$BriefingsTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get briefingId => $composableBuilder(
    column: $table.briefingId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get userId => $composableBuilder(
    column: $table.userId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get dateKey => $composableBuilder(
    column: $table.dateKey,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get mustDoJson => $composableBuilder(
    column: $table.mustDoJson,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get tasksJson => $composableBuilder(
    column: $table.tasksJson,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get advice => $composableBuilder(
    column: $table.advice,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get adviceBasis => $composableBuilder(
    column: $table.adviceBasis,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<DateTime> get createdAt => $composableBuilder(
    column: $table.createdAt,
    builder: (column) => ColumnOrderings(column),
  );
}

class $$BriefingsTableAnnotationComposer
    extends Composer<_$AppDatabase, $BriefingsTable> {
  $$BriefingsTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get briefingId => $composableBuilder(
    column: $table.briefingId,
    builder: (column) => column,
  );

  GeneratedColumn<String> get userId =>
      $composableBuilder(column: $table.userId, builder: (column) => column);

  GeneratedColumn<String> get dateKey =>
      $composableBuilder(column: $table.dateKey, builder: (column) => column);

  GeneratedColumn<String> get mustDoJson => $composableBuilder(
    column: $table.mustDoJson,
    builder: (column) => column,
  );

  GeneratedColumn<String> get tasksJson =>
      $composableBuilder(column: $table.tasksJson, builder: (column) => column);

  GeneratedColumn<String> get advice =>
      $composableBuilder(column: $table.advice, builder: (column) => column);

  GeneratedColumn<String> get adviceBasis => $composableBuilder(
    column: $table.adviceBasis,
    builder: (column) => column,
  );

  GeneratedColumn<DateTime> get createdAt =>
      $composableBuilder(column: $table.createdAt, builder: (column) => column);
}

class $$BriefingsTableTableManager
    extends
        RootTableManager<
          _$AppDatabase,
          $BriefingsTable,
          Briefing,
          $$BriefingsTableFilterComposer,
          $$BriefingsTableOrderingComposer,
          $$BriefingsTableAnnotationComposer,
          $$BriefingsTableCreateCompanionBuilder,
          $$BriefingsTableUpdateCompanionBuilder,
          (Briefing, BaseReferences<_$AppDatabase, $BriefingsTable, Briefing>),
          Briefing,
          PrefetchHooks Function()
        > {
  $$BriefingsTableTableManager(_$AppDatabase db, $BriefingsTable table)
    : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$BriefingsTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$BriefingsTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$BriefingsTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback:
              ({
                Value<String> briefingId = const Value.absent(),
                Value<String> userId = const Value.absent(),
                Value<String> dateKey = const Value.absent(),
                Value<String> mustDoJson = const Value.absent(),
                Value<String> tasksJson = const Value.absent(),
                Value<String?> advice = const Value.absent(),
                Value<String?> adviceBasis = const Value.absent(),
                Value<DateTime> createdAt = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => BriefingsCompanion(
                briefingId: briefingId,
                userId: userId,
                dateKey: dateKey,
                mustDoJson: mustDoJson,
                tasksJson: tasksJson,
                advice: advice,
                adviceBasis: adviceBasis,
                createdAt: createdAt,
                rowid: rowid,
              ),
          createCompanionCallback:
              ({
                required String briefingId,
                required String userId,
                required String dateKey,
                Value<String> mustDoJson = const Value.absent(),
                Value<String> tasksJson = const Value.absent(),
                Value<String?> advice = const Value.absent(),
                Value<String?> adviceBasis = const Value.absent(),
                Value<DateTime> createdAt = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => BriefingsCompanion.insert(
                briefingId: briefingId,
                userId: userId,
                dateKey: dateKey,
                mustDoJson: mustDoJson,
                tasksJson: tasksJson,
                advice: advice,
                adviceBasis: adviceBasis,
                createdAt: createdAt,
                rowid: rowid,
              ),
          withReferenceMapper: (p0) => p0
              .map((e) => (e.readTable(table), BaseReferences(db, table, e)))
              .toList(),
          prefetchHooksCallback: null,
        ),
      );
}

typedef $$BriefingsTableProcessedTableManager =
    ProcessedTableManager<
      _$AppDatabase,
      $BriefingsTable,
      Briefing,
      $$BriefingsTableFilterComposer,
      $$BriefingsTableOrderingComposer,
      $$BriefingsTableAnnotationComposer,
      $$BriefingsTableCreateCompanionBuilder,
      $$BriefingsTableUpdateCompanionBuilder,
      (Briefing, BaseReferences<_$AppDatabase, $BriefingsTable, Briefing>),
      Briefing,
      PrefetchHooks Function()
    >;
typedef $$RollingSummariesTableCreateCompanionBuilder =
    RollingSummariesCompanion Function({
      required String summaryId,
      required String userId,
      Value<String?> sleepSummary,
      Value<String?> expenseSummary,
      Value<String?> lifeSummary,
      Value<String?> lastAdvice,
      Value<DateTime> updatedAt,
      Value<int> rowid,
    });
typedef $$RollingSummariesTableUpdateCompanionBuilder =
    RollingSummariesCompanion Function({
      Value<String> summaryId,
      Value<String> userId,
      Value<String?> sleepSummary,
      Value<String?> expenseSummary,
      Value<String?> lifeSummary,
      Value<String?> lastAdvice,
      Value<DateTime> updatedAt,
      Value<int> rowid,
    });

class $$RollingSummariesTableFilterComposer
    extends Composer<_$AppDatabase, $RollingSummariesTable> {
  $$RollingSummariesTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get summaryId => $composableBuilder(
    column: $table.summaryId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get userId => $composableBuilder(
    column: $table.userId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get sleepSummary => $composableBuilder(
    column: $table.sleepSummary,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get expenseSummary => $composableBuilder(
    column: $table.expenseSummary,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get lifeSummary => $composableBuilder(
    column: $table.lifeSummary,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get lastAdvice => $composableBuilder(
    column: $table.lastAdvice,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<DateTime> get updatedAt => $composableBuilder(
    column: $table.updatedAt,
    builder: (column) => ColumnFilters(column),
  );
}

class $$RollingSummariesTableOrderingComposer
    extends Composer<_$AppDatabase, $RollingSummariesTable> {
  $$RollingSummariesTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get summaryId => $composableBuilder(
    column: $table.summaryId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get userId => $composableBuilder(
    column: $table.userId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get sleepSummary => $composableBuilder(
    column: $table.sleepSummary,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get expenseSummary => $composableBuilder(
    column: $table.expenseSummary,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get lifeSummary => $composableBuilder(
    column: $table.lifeSummary,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get lastAdvice => $composableBuilder(
    column: $table.lastAdvice,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<DateTime> get updatedAt => $composableBuilder(
    column: $table.updatedAt,
    builder: (column) => ColumnOrderings(column),
  );
}

class $$RollingSummariesTableAnnotationComposer
    extends Composer<_$AppDatabase, $RollingSummariesTable> {
  $$RollingSummariesTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get summaryId =>
      $composableBuilder(column: $table.summaryId, builder: (column) => column);

  GeneratedColumn<String> get userId =>
      $composableBuilder(column: $table.userId, builder: (column) => column);

  GeneratedColumn<String> get sleepSummary => $composableBuilder(
    column: $table.sleepSummary,
    builder: (column) => column,
  );

  GeneratedColumn<String> get expenseSummary => $composableBuilder(
    column: $table.expenseSummary,
    builder: (column) => column,
  );

  GeneratedColumn<String> get lifeSummary => $composableBuilder(
    column: $table.lifeSummary,
    builder: (column) => column,
  );

  GeneratedColumn<String> get lastAdvice => $composableBuilder(
    column: $table.lastAdvice,
    builder: (column) => column,
  );

  GeneratedColumn<DateTime> get updatedAt =>
      $composableBuilder(column: $table.updatedAt, builder: (column) => column);
}

class $$RollingSummariesTableTableManager
    extends
        RootTableManager<
          _$AppDatabase,
          $RollingSummariesTable,
          RollingSummary,
          $$RollingSummariesTableFilterComposer,
          $$RollingSummariesTableOrderingComposer,
          $$RollingSummariesTableAnnotationComposer,
          $$RollingSummariesTableCreateCompanionBuilder,
          $$RollingSummariesTableUpdateCompanionBuilder,
          (
            RollingSummary,
            BaseReferences<
              _$AppDatabase,
              $RollingSummariesTable,
              RollingSummary
            >,
          ),
          RollingSummary,
          PrefetchHooks Function()
        > {
  $$RollingSummariesTableTableManager(
    _$AppDatabase db,
    $RollingSummariesTable table,
  ) : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$RollingSummariesTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$RollingSummariesTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$RollingSummariesTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback:
              ({
                Value<String> summaryId = const Value.absent(),
                Value<String> userId = const Value.absent(),
                Value<String?> sleepSummary = const Value.absent(),
                Value<String?> expenseSummary = const Value.absent(),
                Value<String?> lifeSummary = const Value.absent(),
                Value<String?> lastAdvice = const Value.absent(),
                Value<DateTime> updatedAt = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => RollingSummariesCompanion(
                summaryId: summaryId,
                userId: userId,
                sleepSummary: sleepSummary,
                expenseSummary: expenseSummary,
                lifeSummary: lifeSummary,
                lastAdvice: lastAdvice,
                updatedAt: updatedAt,
                rowid: rowid,
              ),
          createCompanionCallback:
              ({
                required String summaryId,
                required String userId,
                Value<String?> sleepSummary = const Value.absent(),
                Value<String?> expenseSummary = const Value.absent(),
                Value<String?> lifeSummary = const Value.absent(),
                Value<String?> lastAdvice = const Value.absent(),
                Value<DateTime> updatedAt = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => RollingSummariesCompanion.insert(
                summaryId: summaryId,
                userId: userId,
                sleepSummary: sleepSummary,
                expenseSummary: expenseSummary,
                lifeSummary: lifeSummary,
                lastAdvice: lastAdvice,
                updatedAt: updatedAt,
                rowid: rowid,
              ),
          withReferenceMapper: (p0) => p0
              .map((e) => (e.readTable(table), BaseReferences(db, table, e)))
              .toList(),
          prefetchHooksCallback: null,
        ),
      );
}

typedef $$RollingSummariesTableProcessedTableManager =
    ProcessedTableManager<
      _$AppDatabase,
      $RollingSummariesTable,
      RollingSummary,
      $$RollingSummariesTableFilterComposer,
      $$RollingSummariesTableOrderingComposer,
      $$RollingSummariesTableAnnotationComposer,
      $$RollingSummariesTableCreateCompanionBuilder,
      $$RollingSummariesTableUpdateCompanionBuilder,
      (
        RollingSummary,
        BaseReferences<_$AppDatabase, $RollingSummariesTable, RollingSummary>,
      ),
      RollingSummary,
      PrefetchHooks Function()
    >;
typedef $$TripsTableCreateCompanionBuilder =
    TripsCompanion Function({
      required String tripId,
      required String userId,
      required String name,
      required String destination,
      required DateTime startDate,
      required DateTime endDate,
      Value<int> budgetTotal,
      Value<String> budgetJson,
      Value<String> status,
      Value<int?> rating,
      Value<String?> review,
      Value<String?> llmSummary,
      Value<String?> reviewPhotosJson,
      Value<DateTime> createdAt,
      Value<int> rowid,
    });
typedef $$TripsTableUpdateCompanionBuilder =
    TripsCompanion Function({
      Value<String> tripId,
      Value<String> userId,
      Value<String> name,
      Value<String> destination,
      Value<DateTime> startDate,
      Value<DateTime> endDate,
      Value<int> budgetTotal,
      Value<String> budgetJson,
      Value<String> status,
      Value<int?> rating,
      Value<String?> review,
      Value<String?> llmSummary,
      Value<String?> reviewPhotosJson,
      Value<DateTime> createdAt,
      Value<int> rowid,
    });

class $$TripsTableFilterComposer extends Composer<_$AppDatabase, $TripsTable> {
  $$TripsTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get tripId => $composableBuilder(
    column: $table.tripId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get userId => $composableBuilder(
    column: $table.userId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get name => $composableBuilder(
    column: $table.name,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get destination => $composableBuilder(
    column: $table.destination,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<DateTime> get startDate => $composableBuilder(
    column: $table.startDate,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<DateTime> get endDate => $composableBuilder(
    column: $table.endDate,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get budgetTotal => $composableBuilder(
    column: $table.budgetTotal,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get budgetJson => $composableBuilder(
    column: $table.budgetJson,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get status => $composableBuilder(
    column: $table.status,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get rating => $composableBuilder(
    column: $table.rating,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get review => $composableBuilder(
    column: $table.review,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get llmSummary => $composableBuilder(
    column: $table.llmSummary,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get reviewPhotosJson => $composableBuilder(
    column: $table.reviewPhotosJson,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<DateTime> get createdAt => $composableBuilder(
    column: $table.createdAt,
    builder: (column) => ColumnFilters(column),
  );
}

class $$TripsTableOrderingComposer
    extends Composer<_$AppDatabase, $TripsTable> {
  $$TripsTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get tripId => $composableBuilder(
    column: $table.tripId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get userId => $composableBuilder(
    column: $table.userId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get name => $composableBuilder(
    column: $table.name,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get destination => $composableBuilder(
    column: $table.destination,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<DateTime> get startDate => $composableBuilder(
    column: $table.startDate,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<DateTime> get endDate => $composableBuilder(
    column: $table.endDate,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get budgetTotal => $composableBuilder(
    column: $table.budgetTotal,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get budgetJson => $composableBuilder(
    column: $table.budgetJson,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get status => $composableBuilder(
    column: $table.status,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get rating => $composableBuilder(
    column: $table.rating,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get review => $composableBuilder(
    column: $table.review,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get llmSummary => $composableBuilder(
    column: $table.llmSummary,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get reviewPhotosJson => $composableBuilder(
    column: $table.reviewPhotosJson,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<DateTime> get createdAt => $composableBuilder(
    column: $table.createdAt,
    builder: (column) => ColumnOrderings(column),
  );
}

class $$TripsTableAnnotationComposer
    extends Composer<_$AppDatabase, $TripsTable> {
  $$TripsTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get tripId =>
      $composableBuilder(column: $table.tripId, builder: (column) => column);

  GeneratedColumn<String> get userId =>
      $composableBuilder(column: $table.userId, builder: (column) => column);

  GeneratedColumn<String> get name =>
      $composableBuilder(column: $table.name, builder: (column) => column);

  GeneratedColumn<String> get destination => $composableBuilder(
    column: $table.destination,
    builder: (column) => column,
  );

  GeneratedColumn<DateTime> get startDate =>
      $composableBuilder(column: $table.startDate, builder: (column) => column);

  GeneratedColumn<DateTime> get endDate =>
      $composableBuilder(column: $table.endDate, builder: (column) => column);

  GeneratedColumn<int> get budgetTotal => $composableBuilder(
    column: $table.budgetTotal,
    builder: (column) => column,
  );

  GeneratedColumn<String> get budgetJson => $composableBuilder(
    column: $table.budgetJson,
    builder: (column) => column,
  );

  GeneratedColumn<String> get status =>
      $composableBuilder(column: $table.status, builder: (column) => column);

  GeneratedColumn<int> get rating =>
      $composableBuilder(column: $table.rating, builder: (column) => column);

  GeneratedColumn<String> get review =>
      $composableBuilder(column: $table.review, builder: (column) => column);

  GeneratedColumn<String> get llmSummary => $composableBuilder(
    column: $table.llmSummary,
    builder: (column) => column,
  );

  GeneratedColumn<String> get reviewPhotosJson => $composableBuilder(
    column: $table.reviewPhotosJson,
    builder: (column) => column,
  );

  GeneratedColumn<DateTime> get createdAt =>
      $composableBuilder(column: $table.createdAt, builder: (column) => column);
}

class $$TripsTableTableManager
    extends
        RootTableManager<
          _$AppDatabase,
          $TripsTable,
          Trip,
          $$TripsTableFilterComposer,
          $$TripsTableOrderingComposer,
          $$TripsTableAnnotationComposer,
          $$TripsTableCreateCompanionBuilder,
          $$TripsTableUpdateCompanionBuilder,
          (Trip, BaseReferences<_$AppDatabase, $TripsTable, Trip>),
          Trip,
          PrefetchHooks Function()
        > {
  $$TripsTableTableManager(_$AppDatabase db, $TripsTable table)
    : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$TripsTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$TripsTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$TripsTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback:
              ({
                Value<String> tripId = const Value.absent(),
                Value<String> userId = const Value.absent(),
                Value<String> name = const Value.absent(),
                Value<String> destination = const Value.absent(),
                Value<DateTime> startDate = const Value.absent(),
                Value<DateTime> endDate = const Value.absent(),
                Value<int> budgetTotal = const Value.absent(),
                Value<String> budgetJson = const Value.absent(),
                Value<String> status = const Value.absent(),
                Value<int?> rating = const Value.absent(),
                Value<String?> review = const Value.absent(),
                Value<String?> llmSummary = const Value.absent(),
                Value<String?> reviewPhotosJson = const Value.absent(),
                Value<DateTime> createdAt = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => TripsCompanion(
                tripId: tripId,
                userId: userId,
                name: name,
                destination: destination,
                startDate: startDate,
                endDate: endDate,
                budgetTotal: budgetTotal,
                budgetJson: budgetJson,
                status: status,
                rating: rating,
                review: review,
                llmSummary: llmSummary,
                reviewPhotosJson: reviewPhotosJson,
                createdAt: createdAt,
                rowid: rowid,
              ),
          createCompanionCallback:
              ({
                required String tripId,
                required String userId,
                required String name,
                required String destination,
                required DateTime startDate,
                required DateTime endDate,
                Value<int> budgetTotal = const Value.absent(),
                Value<String> budgetJson = const Value.absent(),
                Value<String> status = const Value.absent(),
                Value<int?> rating = const Value.absent(),
                Value<String?> review = const Value.absent(),
                Value<String?> llmSummary = const Value.absent(),
                Value<String?> reviewPhotosJson = const Value.absent(),
                Value<DateTime> createdAt = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => TripsCompanion.insert(
                tripId: tripId,
                userId: userId,
                name: name,
                destination: destination,
                startDate: startDate,
                endDate: endDate,
                budgetTotal: budgetTotal,
                budgetJson: budgetJson,
                status: status,
                rating: rating,
                review: review,
                llmSummary: llmSummary,
                reviewPhotosJson: reviewPhotosJson,
                createdAt: createdAt,
                rowid: rowid,
              ),
          withReferenceMapper: (p0) => p0
              .map((e) => (e.readTable(table), BaseReferences(db, table, e)))
              .toList(),
          prefetchHooksCallback: null,
        ),
      );
}

typedef $$TripsTableProcessedTableManager =
    ProcessedTableManager<
      _$AppDatabase,
      $TripsTable,
      Trip,
      $$TripsTableFilterComposer,
      $$TripsTableOrderingComposer,
      $$TripsTableAnnotationComposer,
      $$TripsTableCreateCompanionBuilder,
      $$TripsTableUpdateCompanionBuilder,
      (Trip, BaseReferences<_$AppDatabase, $TripsTable, Trip>),
      Trip,
      PrefetchHooks Function()
    >;
typedef $$TripDayPlansTableCreateCompanionBuilder =
    TripDayPlansCompanion Function({
      required String planId,
      required String tripId,
      required DateTime date,
      Value<String?> originalTitle,
      required String title,
      Value<String?> content,
      Value<String> status,
      Value<String?> actualNote,
      Value<String?> photoUri,
      Value<int> sortOrder,
      Value<DateTime> createdAt,
      Value<int> rowid,
    });
typedef $$TripDayPlansTableUpdateCompanionBuilder =
    TripDayPlansCompanion Function({
      Value<String> planId,
      Value<String> tripId,
      Value<DateTime> date,
      Value<String?> originalTitle,
      Value<String> title,
      Value<String?> content,
      Value<String> status,
      Value<String?> actualNote,
      Value<String?> photoUri,
      Value<int> sortOrder,
      Value<DateTime> createdAt,
      Value<int> rowid,
    });

class $$TripDayPlansTableFilterComposer
    extends Composer<_$AppDatabase, $TripDayPlansTable> {
  $$TripDayPlansTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get planId => $composableBuilder(
    column: $table.planId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get tripId => $composableBuilder(
    column: $table.tripId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<DateTime> get date => $composableBuilder(
    column: $table.date,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get originalTitle => $composableBuilder(
    column: $table.originalTitle,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get title => $composableBuilder(
    column: $table.title,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get content => $composableBuilder(
    column: $table.content,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get status => $composableBuilder(
    column: $table.status,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get actualNote => $composableBuilder(
    column: $table.actualNote,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get photoUri => $composableBuilder(
    column: $table.photoUri,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get sortOrder => $composableBuilder(
    column: $table.sortOrder,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<DateTime> get createdAt => $composableBuilder(
    column: $table.createdAt,
    builder: (column) => ColumnFilters(column),
  );
}

class $$TripDayPlansTableOrderingComposer
    extends Composer<_$AppDatabase, $TripDayPlansTable> {
  $$TripDayPlansTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get planId => $composableBuilder(
    column: $table.planId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get tripId => $composableBuilder(
    column: $table.tripId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<DateTime> get date => $composableBuilder(
    column: $table.date,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get originalTitle => $composableBuilder(
    column: $table.originalTitle,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get title => $composableBuilder(
    column: $table.title,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get content => $composableBuilder(
    column: $table.content,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get status => $composableBuilder(
    column: $table.status,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get actualNote => $composableBuilder(
    column: $table.actualNote,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get photoUri => $composableBuilder(
    column: $table.photoUri,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get sortOrder => $composableBuilder(
    column: $table.sortOrder,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<DateTime> get createdAt => $composableBuilder(
    column: $table.createdAt,
    builder: (column) => ColumnOrderings(column),
  );
}

class $$TripDayPlansTableAnnotationComposer
    extends Composer<_$AppDatabase, $TripDayPlansTable> {
  $$TripDayPlansTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get planId =>
      $composableBuilder(column: $table.planId, builder: (column) => column);

  GeneratedColumn<String> get tripId =>
      $composableBuilder(column: $table.tripId, builder: (column) => column);

  GeneratedColumn<DateTime> get date =>
      $composableBuilder(column: $table.date, builder: (column) => column);

  GeneratedColumn<String> get originalTitle => $composableBuilder(
    column: $table.originalTitle,
    builder: (column) => column,
  );

  GeneratedColumn<String> get title =>
      $composableBuilder(column: $table.title, builder: (column) => column);

  GeneratedColumn<String> get content =>
      $composableBuilder(column: $table.content, builder: (column) => column);

  GeneratedColumn<String> get status =>
      $composableBuilder(column: $table.status, builder: (column) => column);

  GeneratedColumn<String> get actualNote => $composableBuilder(
    column: $table.actualNote,
    builder: (column) => column,
  );

  GeneratedColumn<String> get photoUri =>
      $composableBuilder(column: $table.photoUri, builder: (column) => column);

  GeneratedColumn<int> get sortOrder =>
      $composableBuilder(column: $table.sortOrder, builder: (column) => column);

  GeneratedColumn<DateTime> get createdAt =>
      $composableBuilder(column: $table.createdAt, builder: (column) => column);
}

class $$TripDayPlansTableTableManager
    extends
        RootTableManager<
          _$AppDatabase,
          $TripDayPlansTable,
          TripDayPlan,
          $$TripDayPlansTableFilterComposer,
          $$TripDayPlansTableOrderingComposer,
          $$TripDayPlansTableAnnotationComposer,
          $$TripDayPlansTableCreateCompanionBuilder,
          $$TripDayPlansTableUpdateCompanionBuilder,
          (
            TripDayPlan,
            BaseReferences<_$AppDatabase, $TripDayPlansTable, TripDayPlan>,
          ),
          TripDayPlan,
          PrefetchHooks Function()
        > {
  $$TripDayPlansTableTableManager(_$AppDatabase db, $TripDayPlansTable table)
    : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$TripDayPlansTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$TripDayPlansTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$TripDayPlansTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback:
              ({
                Value<String> planId = const Value.absent(),
                Value<String> tripId = const Value.absent(),
                Value<DateTime> date = const Value.absent(),
                Value<String?> originalTitle = const Value.absent(),
                Value<String> title = const Value.absent(),
                Value<String?> content = const Value.absent(),
                Value<String> status = const Value.absent(),
                Value<String?> actualNote = const Value.absent(),
                Value<String?> photoUri = const Value.absent(),
                Value<int> sortOrder = const Value.absent(),
                Value<DateTime> createdAt = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => TripDayPlansCompanion(
                planId: planId,
                tripId: tripId,
                date: date,
                originalTitle: originalTitle,
                title: title,
                content: content,
                status: status,
                actualNote: actualNote,
                photoUri: photoUri,
                sortOrder: sortOrder,
                createdAt: createdAt,
                rowid: rowid,
              ),
          createCompanionCallback:
              ({
                required String planId,
                required String tripId,
                required DateTime date,
                Value<String?> originalTitle = const Value.absent(),
                required String title,
                Value<String?> content = const Value.absent(),
                Value<String> status = const Value.absent(),
                Value<String?> actualNote = const Value.absent(),
                Value<String?> photoUri = const Value.absent(),
                Value<int> sortOrder = const Value.absent(),
                Value<DateTime> createdAt = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => TripDayPlansCompanion.insert(
                planId: planId,
                tripId: tripId,
                date: date,
                originalTitle: originalTitle,
                title: title,
                content: content,
                status: status,
                actualNote: actualNote,
                photoUri: photoUri,
                sortOrder: sortOrder,
                createdAt: createdAt,
                rowid: rowid,
              ),
          withReferenceMapper: (p0) => p0
              .map((e) => (e.readTable(table), BaseReferences(db, table, e)))
              .toList(),
          prefetchHooksCallback: null,
        ),
      );
}

typedef $$TripDayPlansTableProcessedTableManager =
    ProcessedTableManager<
      _$AppDatabase,
      $TripDayPlansTable,
      TripDayPlan,
      $$TripDayPlansTableFilterComposer,
      $$TripDayPlansTableOrderingComposer,
      $$TripDayPlansTableAnnotationComposer,
      $$TripDayPlansTableCreateCompanionBuilder,
      $$TripDayPlansTableUpdateCompanionBuilder,
      (
        TripDayPlan,
        BaseReferences<_$AppDatabase, $TripDayPlansTable, TripDayPlan>,
      ),
      TripDayPlan,
      PrefetchHooks Function()
    >;
typedef $$TripChecklistsTableCreateCompanionBuilder =
    TripChecklistsCompanion Function({
      required String checkId,
      required String tripId,
      required String item,
      Value<String?> category,
      Value<bool> isDone,
      Value<int> sortOrder,
      Value<DateTime> createdAt,
      Value<int> rowid,
    });
typedef $$TripChecklistsTableUpdateCompanionBuilder =
    TripChecklistsCompanion Function({
      Value<String> checkId,
      Value<String> tripId,
      Value<String> item,
      Value<String?> category,
      Value<bool> isDone,
      Value<int> sortOrder,
      Value<DateTime> createdAt,
      Value<int> rowid,
    });

class $$TripChecklistsTableFilterComposer
    extends Composer<_$AppDatabase, $TripChecklistsTable> {
  $$TripChecklistsTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get checkId => $composableBuilder(
    column: $table.checkId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get tripId => $composableBuilder(
    column: $table.tripId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get item => $composableBuilder(
    column: $table.item,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get category => $composableBuilder(
    column: $table.category,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<bool> get isDone => $composableBuilder(
    column: $table.isDone,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get sortOrder => $composableBuilder(
    column: $table.sortOrder,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<DateTime> get createdAt => $composableBuilder(
    column: $table.createdAt,
    builder: (column) => ColumnFilters(column),
  );
}

class $$TripChecklistsTableOrderingComposer
    extends Composer<_$AppDatabase, $TripChecklistsTable> {
  $$TripChecklistsTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get checkId => $composableBuilder(
    column: $table.checkId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get tripId => $composableBuilder(
    column: $table.tripId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get item => $composableBuilder(
    column: $table.item,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get category => $composableBuilder(
    column: $table.category,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<bool> get isDone => $composableBuilder(
    column: $table.isDone,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get sortOrder => $composableBuilder(
    column: $table.sortOrder,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<DateTime> get createdAt => $composableBuilder(
    column: $table.createdAt,
    builder: (column) => ColumnOrderings(column),
  );
}

class $$TripChecklistsTableAnnotationComposer
    extends Composer<_$AppDatabase, $TripChecklistsTable> {
  $$TripChecklistsTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get checkId =>
      $composableBuilder(column: $table.checkId, builder: (column) => column);

  GeneratedColumn<String> get tripId =>
      $composableBuilder(column: $table.tripId, builder: (column) => column);

  GeneratedColumn<String> get item =>
      $composableBuilder(column: $table.item, builder: (column) => column);

  GeneratedColumn<String> get category =>
      $composableBuilder(column: $table.category, builder: (column) => column);

  GeneratedColumn<bool> get isDone =>
      $composableBuilder(column: $table.isDone, builder: (column) => column);

  GeneratedColumn<int> get sortOrder =>
      $composableBuilder(column: $table.sortOrder, builder: (column) => column);

  GeneratedColumn<DateTime> get createdAt =>
      $composableBuilder(column: $table.createdAt, builder: (column) => column);
}

class $$TripChecklistsTableTableManager
    extends
        RootTableManager<
          _$AppDatabase,
          $TripChecklistsTable,
          TripChecklist,
          $$TripChecklistsTableFilterComposer,
          $$TripChecklistsTableOrderingComposer,
          $$TripChecklistsTableAnnotationComposer,
          $$TripChecklistsTableCreateCompanionBuilder,
          $$TripChecklistsTableUpdateCompanionBuilder,
          (
            TripChecklist,
            BaseReferences<_$AppDatabase, $TripChecklistsTable, TripChecklist>,
          ),
          TripChecklist,
          PrefetchHooks Function()
        > {
  $$TripChecklistsTableTableManager(
    _$AppDatabase db,
    $TripChecklistsTable table,
  ) : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$TripChecklistsTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$TripChecklistsTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$TripChecklistsTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback:
              ({
                Value<String> checkId = const Value.absent(),
                Value<String> tripId = const Value.absent(),
                Value<String> item = const Value.absent(),
                Value<String?> category = const Value.absent(),
                Value<bool> isDone = const Value.absent(),
                Value<int> sortOrder = const Value.absent(),
                Value<DateTime> createdAt = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => TripChecklistsCompanion(
                checkId: checkId,
                tripId: tripId,
                item: item,
                category: category,
                isDone: isDone,
                sortOrder: sortOrder,
                createdAt: createdAt,
                rowid: rowid,
              ),
          createCompanionCallback:
              ({
                required String checkId,
                required String tripId,
                required String item,
                Value<String?> category = const Value.absent(),
                Value<bool> isDone = const Value.absent(),
                Value<int> sortOrder = const Value.absent(),
                Value<DateTime> createdAt = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => TripChecklistsCompanion.insert(
                checkId: checkId,
                tripId: tripId,
                item: item,
                category: category,
                isDone: isDone,
                sortOrder: sortOrder,
                createdAt: createdAt,
                rowid: rowid,
              ),
          withReferenceMapper: (p0) => p0
              .map((e) => (e.readTable(table), BaseReferences(db, table, e)))
              .toList(),
          prefetchHooksCallback: null,
        ),
      );
}

typedef $$TripChecklistsTableProcessedTableManager =
    ProcessedTableManager<
      _$AppDatabase,
      $TripChecklistsTable,
      TripChecklist,
      $$TripChecklistsTableFilterComposer,
      $$TripChecklistsTableOrderingComposer,
      $$TripChecklistsTableAnnotationComposer,
      $$TripChecklistsTableCreateCompanionBuilder,
      $$TripChecklistsTableUpdateCompanionBuilder,
      (
        TripChecklist,
        BaseReferences<_$AppDatabase, $TripChecklistsTable, TripChecklist>,
      ),
      TripChecklist,
      PrefetchHooks Function()
    >;

class $AppDatabaseManager {
  final _$AppDatabase _db;
  $AppDatabaseManager(this._db);
  $$UsersTableTableManager get users =>
      $$UsersTableTableManager(_db, _db.users);
  $$CalendarEventsTableTableManager get calendarEvents =>
      $$CalendarEventsTableTableManager(_db, _db.calendarEvents);
  $$MeetingsTableTableManager get meetings =>
      $$MeetingsTableTableManager(_db, _db.meetings);
  $$TranscriptSegmentsTableTableManager get transcriptSegments =>
      $$TranscriptSegmentsTableTableManager(_db, _db.transcriptSegments);
  $$ExtractedItemsTableTableManager get extractedItems =>
      $$ExtractedItemsTableTableManager(_db, _db.extractedItems);
  $$MealRecordsTableTableManager get mealRecords =>
      $$MealRecordsTableTableManager(_db, _db.mealRecords);
  $$DailyContextsTableTableManager get dailyContexts =>
      $$DailyContextsTableTableManager(_db, _db.dailyContexts);
  $$MedicationRecordsTableTableManager get medicationRecords =>
      $$MedicationRecordsTableTableManager(_db, _db.medicationRecords);
  $$ExerciseRecordsTableTableManager get exerciseRecords =>
      $$ExerciseRecordsTableTableManager(_db, _db.exerciseRecords);
  $$HospitalRecordsTableTableManager get hospitalRecords =>
      $$HospitalRecordsTableTableManager(_db, _db.hospitalRecords);
  $$SleepRecordsTableTableManager get sleepRecords =>
      $$SleepRecordsTableTableManager(_db, _db.sleepRecords);
  $$RoutineItemsTableTableManager get routineItems =>
      $$RoutineItemsTableTableManager(_db, _db.routineItems);
  $$RoutineCompletionsTableTableManager get routineCompletions =>
      $$RoutineCompletionsTableTableManager(_db, _db.routineCompletions);
  $$FashionRecordsTableTableManager get fashionRecords =>
      $$FashionRecordsTableTableManager(_db, _db.fashionRecords);
  $$PrepareItemsTableTableManager get prepareItems =>
      $$PrepareItemsTableTableManager(_db, _db.prepareItems);
  $$SubscriptionItemsTableTableManager get subscriptionItems =>
      $$SubscriptionItemsTableTableManager(_db, _db.subscriptionItems);
  $$CaptureItemsTableTableManager get captureItems =>
      $$CaptureItemsTableTableManager(_db, _db.captureItems);
  $$ExtractedCapturesTableTableManager get extractedCaptures =>
      $$ExtractedCapturesTableTableManager(_db, _db.extractedCaptures);
  $$TransactionsTableTableManager get transactions =>
      $$TransactionsTableTableManager(_db, _db.transactions);
  $$MemosTableTableManager get memos =>
      $$MemosTableTableManager(_db, _db.memos);
  $$BriefingsTableTableManager get briefings =>
      $$BriefingsTableTableManager(_db, _db.briefings);
  $$RollingSummariesTableTableManager get rollingSummaries =>
      $$RollingSummariesTableTableManager(_db, _db.rollingSummaries);
  $$TripsTableTableManager get trips =>
      $$TripsTableTableManager(_db, _db.trips);
  $$TripDayPlansTableTableManager get tripDayPlans =>
      $$TripDayPlansTableTableManager(_db, _db.tripDayPlans);
  $$TripChecklistsTableTableManager get tripChecklists =>
      $$TripChecklistsTableTableManager(_db, _db.tripChecklists);
}
