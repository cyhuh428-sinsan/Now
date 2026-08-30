// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'note_database.dart';

// ignore_for_file: type=lint
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

abstract class _$NoteDatabase extends GeneratedDatabase {
  _$NoteDatabase(QueryExecutor e) : super(e);
  $NoteDatabaseManager get managers => $NoteDatabaseManager(this);
  late final $MeetingsTable meetings = $MeetingsTable(this);
  late final $TranscriptSegmentsTable transcriptSegments =
      $TranscriptSegmentsTable(this);
  late final $MemosTable memos = $MemosTable(this);
  @override
  Iterable<TableInfo<Table, Object?>> get allTables =>
      allSchemaEntities.whereType<TableInfo<Table, Object?>>();
  @override
  List<DatabaseSchemaEntity> get allSchemaEntities => [
    meetings,
    transcriptSegments,
    memos,
  ];
}

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
    extends Composer<_$NoteDatabase, $MeetingsTable> {
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
    extends Composer<_$NoteDatabase, $MeetingsTable> {
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
    extends Composer<_$NoteDatabase, $MeetingsTable> {
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
          _$NoteDatabase,
          $MeetingsTable,
          Meeting,
          $$MeetingsTableFilterComposer,
          $$MeetingsTableOrderingComposer,
          $$MeetingsTableAnnotationComposer,
          $$MeetingsTableCreateCompanionBuilder,
          $$MeetingsTableUpdateCompanionBuilder,
          (Meeting, BaseReferences<_$NoteDatabase, $MeetingsTable, Meeting>),
          Meeting,
          PrefetchHooks Function()
        > {
  $$MeetingsTableTableManager(_$NoteDatabase db, $MeetingsTable table)
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
      _$NoteDatabase,
      $MeetingsTable,
      Meeting,
      $$MeetingsTableFilterComposer,
      $$MeetingsTableOrderingComposer,
      $$MeetingsTableAnnotationComposer,
      $$MeetingsTableCreateCompanionBuilder,
      $$MeetingsTableUpdateCompanionBuilder,
      (Meeting, BaseReferences<_$NoteDatabase, $MeetingsTable, Meeting>),
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
    extends Composer<_$NoteDatabase, $TranscriptSegmentsTable> {
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
    extends Composer<_$NoteDatabase, $TranscriptSegmentsTable> {
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
    extends Composer<_$NoteDatabase, $TranscriptSegmentsTable> {
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
          _$NoteDatabase,
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
              _$NoteDatabase,
              $TranscriptSegmentsTable,
              TranscriptSegment
            >,
          ),
          TranscriptSegment,
          PrefetchHooks Function()
        > {
  $$TranscriptSegmentsTableTableManager(
    _$NoteDatabase db,
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
      _$NoteDatabase,
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
          _$NoteDatabase,
          $TranscriptSegmentsTable,
          TranscriptSegment
        >,
      ),
      TranscriptSegment,
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

class $$MemosTableFilterComposer extends Composer<_$NoteDatabase, $MemosTable> {
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
    extends Composer<_$NoteDatabase, $MemosTable> {
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
    extends Composer<_$NoteDatabase, $MemosTable> {
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
          _$NoteDatabase,
          $MemosTable,
          Memo,
          $$MemosTableFilterComposer,
          $$MemosTableOrderingComposer,
          $$MemosTableAnnotationComposer,
          $$MemosTableCreateCompanionBuilder,
          $$MemosTableUpdateCompanionBuilder,
          (Memo, BaseReferences<_$NoteDatabase, $MemosTable, Memo>),
          Memo,
          PrefetchHooks Function()
        > {
  $$MemosTableTableManager(_$NoteDatabase db, $MemosTable table)
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
      _$NoteDatabase,
      $MemosTable,
      Memo,
      $$MemosTableFilterComposer,
      $$MemosTableOrderingComposer,
      $$MemosTableAnnotationComposer,
      $$MemosTableCreateCompanionBuilder,
      $$MemosTableUpdateCompanionBuilder,
      (Memo, BaseReferences<_$NoteDatabase, $MemosTable, Memo>),
      Memo,
      PrefetchHooks Function()
    >;

class $NoteDatabaseManager {
  final _$NoteDatabase _db;
  $NoteDatabaseManager(this._db);
  $$MeetingsTableTableManager get meetings =>
      $$MeetingsTableTableManager(_db, _db.meetings);
  $$TranscriptSegmentsTableTableManager get transcriptSegments =>
      $$TranscriptSegmentsTableTableManager(_db, _db.transcriptSegments);
  $$MemosTableTableManager get memos =>
      $$MemosTableTableManager(_db, _db.memos);
}
