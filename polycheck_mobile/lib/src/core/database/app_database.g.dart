// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'app_database.dart';

// ignore_for_file: type=lint
class $CachedSubjectsTable extends CachedSubjects
    with TableInfo<$CachedSubjectsTable, CachedSubjectRow> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $CachedSubjectsTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _userIdMeta = const VerificationMeta('userId');
  @override
  late final GeneratedColumn<String> userId = GeneratedColumn<String>(
    'user_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _idMeta = const VerificationMeta('id');
  @override
  late final GeneratedColumn<String> id = GeneratedColumn<String>(
    'id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _payloadJsonMeta = const VerificationMeta(
    'payloadJson',
  );
  @override
  late final GeneratedColumn<String> payloadJson = GeneratedColumn<String>(
    'payload_json',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _cachedAtMeta = const VerificationMeta(
    'cachedAt',
  );
  @override
  late final GeneratedColumn<DateTime> cachedAt = GeneratedColumn<DateTime>(
    'cached_at',
    aliasedName,
    false,
    type: DriftSqlType.dateTime,
    requiredDuringInsert: true,
  );
  @override
  List<GeneratedColumn> get $columns => [userId, id, payloadJson, cachedAt];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'cached_subjects';
  @override
  VerificationContext validateIntegrity(
    Insertable<CachedSubjectRow> instance, {
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
    if (data.containsKey('id')) {
      context.handle(_idMeta, id.isAcceptableOrUnknown(data['id']!, _idMeta));
    } else if (isInserting) {
      context.missing(_idMeta);
    }
    if (data.containsKey('payload_json')) {
      context.handle(
        _payloadJsonMeta,
        payloadJson.isAcceptableOrUnknown(
          data['payload_json']!,
          _payloadJsonMeta,
        ),
      );
    } else if (isInserting) {
      context.missing(_payloadJsonMeta);
    }
    if (data.containsKey('cached_at')) {
      context.handle(
        _cachedAtMeta,
        cachedAt.isAcceptableOrUnknown(data['cached_at']!, _cachedAtMeta),
      );
    } else if (isInserting) {
      context.missing(_cachedAtMeta);
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {userId, id};
  @override
  CachedSubjectRow map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return CachedSubjectRow(
      userId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}user_id'],
      )!,
      id: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}id'],
      )!,
      payloadJson: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}payload_json'],
      )!,
      cachedAt: attachedDatabase.typeMapping.read(
        DriftSqlType.dateTime,
        data['${effectivePrefix}cached_at'],
      )!,
    );
  }

  @override
  $CachedSubjectsTable createAlias(String alias) {
    return $CachedSubjectsTable(attachedDatabase, alias);
  }
}

class CachedSubjectRow extends DataClass
    implements Insertable<CachedSubjectRow> {
  final String userId;
  final String id;
  final String payloadJson;
  final DateTime cachedAt;
  const CachedSubjectRow({
    required this.userId,
    required this.id,
    required this.payloadJson,
    required this.cachedAt,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['user_id'] = Variable<String>(userId);
    map['id'] = Variable<String>(id);
    map['payload_json'] = Variable<String>(payloadJson);
    map['cached_at'] = Variable<DateTime>(cachedAt);
    return map;
  }

  CachedSubjectsCompanion toCompanion(bool nullToAbsent) {
    return CachedSubjectsCompanion(
      userId: Value(userId),
      id: Value(id),
      payloadJson: Value(payloadJson),
      cachedAt: Value(cachedAt),
    );
  }

  factory CachedSubjectRow.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return CachedSubjectRow(
      userId: serializer.fromJson<String>(json['userId']),
      id: serializer.fromJson<String>(json['id']),
      payloadJson: serializer.fromJson<String>(json['payloadJson']),
      cachedAt: serializer.fromJson<DateTime>(json['cachedAt']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'userId': serializer.toJson<String>(userId),
      'id': serializer.toJson<String>(id),
      'payloadJson': serializer.toJson<String>(payloadJson),
      'cachedAt': serializer.toJson<DateTime>(cachedAt),
    };
  }

  CachedSubjectRow copyWith({
    String? userId,
    String? id,
    String? payloadJson,
    DateTime? cachedAt,
  }) => CachedSubjectRow(
    userId: userId ?? this.userId,
    id: id ?? this.id,
    payloadJson: payloadJson ?? this.payloadJson,
    cachedAt: cachedAt ?? this.cachedAt,
  );
  CachedSubjectRow copyWithCompanion(CachedSubjectsCompanion data) {
    return CachedSubjectRow(
      userId: data.userId.present ? data.userId.value : this.userId,
      id: data.id.present ? data.id.value : this.id,
      payloadJson: data.payloadJson.present
          ? data.payloadJson.value
          : this.payloadJson,
      cachedAt: data.cachedAt.present ? data.cachedAt.value : this.cachedAt,
    );
  }

  @override
  String toString() {
    return (StringBuffer('CachedSubjectRow(')
          ..write('userId: $userId, ')
          ..write('id: $id, ')
          ..write('payloadJson: $payloadJson, ')
          ..write('cachedAt: $cachedAt')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(userId, id, payloadJson, cachedAt);
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is CachedSubjectRow &&
          other.userId == this.userId &&
          other.id == this.id &&
          other.payloadJson == this.payloadJson &&
          other.cachedAt == this.cachedAt);
}

class CachedSubjectsCompanion extends UpdateCompanion<CachedSubjectRow> {
  final Value<String> userId;
  final Value<String> id;
  final Value<String> payloadJson;
  final Value<DateTime> cachedAt;
  final Value<int> rowid;
  const CachedSubjectsCompanion({
    this.userId = const Value.absent(),
    this.id = const Value.absent(),
    this.payloadJson = const Value.absent(),
    this.cachedAt = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  CachedSubjectsCompanion.insert({
    required String userId,
    required String id,
    required String payloadJson,
    required DateTime cachedAt,
    this.rowid = const Value.absent(),
  }) : userId = Value(userId),
       id = Value(id),
       payloadJson = Value(payloadJson),
       cachedAt = Value(cachedAt);
  static Insertable<CachedSubjectRow> custom({
    Expression<String>? userId,
    Expression<String>? id,
    Expression<String>? payloadJson,
    Expression<DateTime>? cachedAt,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (userId != null) 'user_id': userId,
      if (id != null) 'id': id,
      if (payloadJson != null) 'payload_json': payloadJson,
      if (cachedAt != null) 'cached_at': cachedAt,
      if (rowid != null) 'rowid': rowid,
    });
  }

  CachedSubjectsCompanion copyWith({
    Value<String>? userId,
    Value<String>? id,
    Value<String>? payloadJson,
    Value<DateTime>? cachedAt,
    Value<int>? rowid,
  }) {
    return CachedSubjectsCompanion(
      userId: userId ?? this.userId,
      id: id ?? this.id,
      payloadJson: payloadJson ?? this.payloadJson,
      cachedAt: cachedAt ?? this.cachedAt,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (userId.present) {
      map['user_id'] = Variable<String>(userId.value);
    }
    if (id.present) {
      map['id'] = Variable<String>(id.value);
    }
    if (payloadJson.present) {
      map['payload_json'] = Variable<String>(payloadJson.value);
    }
    if (cachedAt.present) {
      map['cached_at'] = Variable<DateTime>(cachedAt.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('CachedSubjectsCompanion(')
          ..write('userId: $userId, ')
          ..write('id: $id, ')
          ..write('payloadJson: $payloadJson, ')
          ..write('cachedAt: $cachedAt, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $CachedSectionsTable extends CachedSections
    with TableInfo<$CachedSectionsTable, CachedSectionRow> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $CachedSectionsTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _userIdMeta = const VerificationMeta('userId');
  @override
  late final GeneratedColumn<String> userId = GeneratedColumn<String>(
    'user_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _idMeta = const VerificationMeta('id');
  @override
  late final GeneratedColumn<String> id = GeneratedColumn<String>(
    'id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _subjectIdMeta = const VerificationMeta(
    'subjectId',
  );
  @override
  late final GeneratedColumn<String> subjectId = GeneratedColumn<String>(
    'subject_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _payloadJsonMeta = const VerificationMeta(
    'payloadJson',
  );
  @override
  late final GeneratedColumn<String> payloadJson = GeneratedColumn<String>(
    'payload_json',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _cachedAtMeta = const VerificationMeta(
    'cachedAt',
  );
  @override
  late final GeneratedColumn<DateTime> cachedAt = GeneratedColumn<DateTime>(
    'cached_at',
    aliasedName,
    false,
    type: DriftSqlType.dateTime,
    requiredDuringInsert: true,
  );
  @override
  List<GeneratedColumn> get $columns => [
    userId,
    id,
    subjectId,
    payloadJson,
    cachedAt,
  ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'cached_sections';
  @override
  VerificationContext validateIntegrity(
    Insertable<CachedSectionRow> instance, {
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
    if (data.containsKey('id')) {
      context.handle(_idMeta, id.isAcceptableOrUnknown(data['id']!, _idMeta));
    } else if (isInserting) {
      context.missing(_idMeta);
    }
    if (data.containsKey('subject_id')) {
      context.handle(
        _subjectIdMeta,
        subjectId.isAcceptableOrUnknown(data['subject_id']!, _subjectIdMeta),
      );
    } else if (isInserting) {
      context.missing(_subjectIdMeta);
    }
    if (data.containsKey('payload_json')) {
      context.handle(
        _payloadJsonMeta,
        payloadJson.isAcceptableOrUnknown(
          data['payload_json']!,
          _payloadJsonMeta,
        ),
      );
    } else if (isInserting) {
      context.missing(_payloadJsonMeta);
    }
    if (data.containsKey('cached_at')) {
      context.handle(
        _cachedAtMeta,
        cachedAt.isAcceptableOrUnknown(data['cached_at']!, _cachedAtMeta),
      );
    } else if (isInserting) {
      context.missing(_cachedAtMeta);
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {userId, id};
  @override
  CachedSectionRow map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return CachedSectionRow(
      userId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}user_id'],
      )!,
      id: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}id'],
      )!,
      subjectId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}subject_id'],
      )!,
      payloadJson: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}payload_json'],
      )!,
      cachedAt: attachedDatabase.typeMapping.read(
        DriftSqlType.dateTime,
        data['${effectivePrefix}cached_at'],
      )!,
    );
  }

  @override
  $CachedSectionsTable createAlias(String alias) {
    return $CachedSectionsTable(attachedDatabase, alias);
  }
}

class CachedSectionRow extends DataClass
    implements Insertable<CachedSectionRow> {
  final String userId;
  final String id;
  final String subjectId;
  final String payloadJson;
  final DateTime cachedAt;
  const CachedSectionRow({
    required this.userId,
    required this.id,
    required this.subjectId,
    required this.payloadJson,
    required this.cachedAt,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['user_id'] = Variable<String>(userId);
    map['id'] = Variable<String>(id);
    map['subject_id'] = Variable<String>(subjectId);
    map['payload_json'] = Variable<String>(payloadJson);
    map['cached_at'] = Variable<DateTime>(cachedAt);
    return map;
  }

  CachedSectionsCompanion toCompanion(bool nullToAbsent) {
    return CachedSectionsCompanion(
      userId: Value(userId),
      id: Value(id),
      subjectId: Value(subjectId),
      payloadJson: Value(payloadJson),
      cachedAt: Value(cachedAt),
    );
  }

  factory CachedSectionRow.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return CachedSectionRow(
      userId: serializer.fromJson<String>(json['userId']),
      id: serializer.fromJson<String>(json['id']),
      subjectId: serializer.fromJson<String>(json['subjectId']),
      payloadJson: serializer.fromJson<String>(json['payloadJson']),
      cachedAt: serializer.fromJson<DateTime>(json['cachedAt']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'userId': serializer.toJson<String>(userId),
      'id': serializer.toJson<String>(id),
      'subjectId': serializer.toJson<String>(subjectId),
      'payloadJson': serializer.toJson<String>(payloadJson),
      'cachedAt': serializer.toJson<DateTime>(cachedAt),
    };
  }

  CachedSectionRow copyWith({
    String? userId,
    String? id,
    String? subjectId,
    String? payloadJson,
    DateTime? cachedAt,
  }) => CachedSectionRow(
    userId: userId ?? this.userId,
    id: id ?? this.id,
    subjectId: subjectId ?? this.subjectId,
    payloadJson: payloadJson ?? this.payloadJson,
    cachedAt: cachedAt ?? this.cachedAt,
  );
  CachedSectionRow copyWithCompanion(CachedSectionsCompanion data) {
    return CachedSectionRow(
      userId: data.userId.present ? data.userId.value : this.userId,
      id: data.id.present ? data.id.value : this.id,
      subjectId: data.subjectId.present ? data.subjectId.value : this.subjectId,
      payloadJson: data.payloadJson.present
          ? data.payloadJson.value
          : this.payloadJson,
      cachedAt: data.cachedAt.present ? data.cachedAt.value : this.cachedAt,
    );
  }

  @override
  String toString() {
    return (StringBuffer('CachedSectionRow(')
          ..write('userId: $userId, ')
          ..write('id: $id, ')
          ..write('subjectId: $subjectId, ')
          ..write('payloadJson: $payloadJson, ')
          ..write('cachedAt: $cachedAt')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(userId, id, subjectId, payloadJson, cachedAt);
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is CachedSectionRow &&
          other.userId == this.userId &&
          other.id == this.id &&
          other.subjectId == this.subjectId &&
          other.payloadJson == this.payloadJson &&
          other.cachedAt == this.cachedAt);
}

class CachedSectionsCompanion extends UpdateCompanion<CachedSectionRow> {
  final Value<String> userId;
  final Value<String> id;
  final Value<String> subjectId;
  final Value<String> payloadJson;
  final Value<DateTime> cachedAt;
  final Value<int> rowid;
  const CachedSectionsCompanion({
    this.userId = const Value.absent(),
    this.id = const Value.absent(),
    this.subjectId = const Value.absent(),
    this.payloadJson = const Value.absent(),
    this.cachedAt = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  CachedSectionsCompanion.insert({
    required String userId,
    required String id,
    required String subjectId,
    required String payloadJson,
    required DateTime cachedAt,
    this.rowid = const Value.absent(),
  }) : userId = Value(userId),
       id = Value(id),
       subjectId = Value(subjectId),
       payloadJson = Value(payloadJson),
       cachedAt = Value(cachedAt);
  static Insertable<CachedSectionRow> custom({
    Expression<String>? userId,
    Expression<String>? id,
    Expression<String>? subjectId,
    Expression<String>? payloadJson,
    Expression<DateTime>? cachedAt,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (userId != null) 'user_id': userId,
      if (id != null) 'id': id,
      if (subjectId != null) 'subject_id': subjectId,
      if (payloadJson != null) 'payload_json': payloadJson,
      if (cachedAt != null) 'cached_at': cachedAt,
      if (rowid != null) 'rowid': rowid,
    });
  }

  CachedSectionsCompanion copyWith({
    Value<String>? userId,
    Value<String>? id,
    Value<String>? subjectId,
    Value<String>? payloadJson,
    Value<DateTime>? cachedAt,
    Value<int>? rowid,
  }) {
    return CachedSectionsCompanion(
      userId: userId ?? this.userId,
      id: id ?? this.id,
      subjectId: subjectId ?? this.subjectId,
      payloadJson: payloadJson ?? this.payloadJson,
      cachedAt: cachedAt ?? this.cachedAt,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (userId.present) {
      map['user_id'] = Variable<String>(userId.value);
    }
    if (id.present) {
      map['id'] = Variable<String>(id.value);
    }
    if (subjectId.present) {
      map['subject_id'] = Variable<String>(subjectId.value);
    }
    if (payloadJson.present) {
      map['payload_json'] = Variable<String>(payloadJson.value);
    }
    if (cachedAt.present) {
      map['cached_at'] = Variable<DateTime>(cachedAt.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('CachedSectionsCompanion(')
          ..write('userId: $userId, ')
          ..write('id: $id, ')
          ..write('subjectId: $subjectId, ')
          ..write('payloadJson: $payloadJson, ')
          ..write('cachedAt: $cachedAt, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $CachedSchedulesTable extends CachedSchedules
    with TableInfo<$CachedSchedulesTable, CachedScheduleRow> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $CachedSchedulesTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _userIdMeta = const VerificationMeta('userId');
  @override
  late final GeneratedColumn<String> userId = GeneratedColumn<String>(
    'user_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _rangeKeyMeta = const VerificationMeta(
    'rangeKey',
  );
  @override
  late final GeneratedColumn<String> rangeKey = GeneratedColumn<String>(
    'range_key',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _payloadJsonMeta = const VerificationMeta(
    'payloadJson',
  );
  @override
  late final GeneratedColumn<String> payloadJson = GeneratedColumn<String>(
    'payload_json',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _cachedAtMeta = const VerificationMeta(
    'cachedAt',
  );
  @override
  late final GeneratedColumn<DateTime> cachedAt = GeneratedColumn<DateTime>(
    'cached_at',
    aliasedName,
    false,
    type: DriftSqlType.dateTime,
    requiredDuringInsert: true,
  );
  @override
  List<GeneratedColumn> get $columns => [
    userId,
    rangeKey,
    payloadJson,
    cachedAt,
  ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'cached_schedules';
  @override
  VerificationContext validateIntegrity(
    Insertable<CachedScheduleRow> instance, {
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
    if (data.containsKey('range_key')) {
      context.handle(
        _rangeKeyMeta,
        rangeKey.isAcceptableOrUnknown(data['range_key']!, _rangeKeyMeta),
      );
    } else if (isInserting) {
      context.missing(_rangeKeyMeta);
    }
    if (data.containsKey('payload_json')) {
      context.handle(
        _payloadJsonMeta,
        payloadJson.isAcceptableOrUnknown(
          data['payload_json']!,
          _payloadJsonMeta,
        ),
      );
    } else if (isInserting) {
      context.missing(_payloadJsonMeta);
    }
    if (data.containsKey('cached_at')) {
      context.handle(
        _cachedAtMeta,
        cachedAt.isAcceptableOrUnknown(data['cached_at']!, _cachedAtMeta),
      );
    } else if (isInserting) {
      context.missing(_cachedAtMeta);
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {userId, rangeKey};
  @override
  CachedScheduleRow map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return CachedScheduleRow(
      userId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}user_id'],
      )!,
      rangeKey: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}range_key'],
      )!,
      payloadJson: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}payload_json'],
      )!,
      cachedAt: attachedDatabase.typeMapping.read(
        DriftSqlType.dateTime,
        data['${effectivePrefix}cached_at'],
      )!,
    );
  }

  @override
  $CachedSchedulesTable createAlias(String alias) {
    return $CachedSchedulesTable(attachedDatabase, alias);
  }
}

class CachedScheduleRow extends DataClass
    implements Insertable<CachedScheduleRow> {
  final String userId;
  final String rangeKey;
  final String payloadJson;
  final DateTime cachedAt;
  const CachedScheduleRow({
    required this.userId,
    required this.rangeKey,
    required this.payloadJson,
    required this.cachedAt,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['user_id'] = Variable<String>(userId);
    map['range_key'] = Variable<String>(rangeKey);
    map['payload_json'] = Variable<String>(payloadJson);
    map['cached_at'] = Variable<DateTime>(cachedAt);
    return map;
  }

  CachedSchedulesCompanion toCompanion(bool nullToAbsent) {
    return CachedSchedulesCompanion(
      userId: Value(userId),
      rangeKey: Value(rangeKey),
      payloadJson: Value(payloadJson),
      cachedAt: Value(cachedAt),
    );
  }

  factory CachedScheduleRow.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return CachedScheduleRow(
      userId: serializer.fromJson<String>(json['userId']),
      rangeKey: serializer.fromJson<String>(json['rangeKey']),
      payloadJson: serializer.fromJson<String>(json['payloadJson']),
      cachedAt: serializer.fromJson<DateTime>(json['cachedAt']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'userId': serializer.toJson<String>(userId),
      'rangeKey': serializer.toJson<String>(rangeKey),
      'payloadJson': serializer.toJson<String>(payloadJson),
      'cachedAt': serializer.toJson<DateTime>(cachedAt),
    };
  }

  CachedScheduleRow copyWith({
    String? userId,
    String? rangeKey,
    String? payloadJson,
    DateTime? cachedAt,
  }) => CachedScheduleRow(
    userId: userId ?? this.userId,
    rangeKey: rangeKey ?? this.rangeKey,
    payloadJson: payloadJson ?? this.payloadJson,
    cachedAt: cachedAt ?? this.cachedAt,
  );
  CachedScheduleRow copyWithCompanion(CachedSchedulesCompanion data) {
    return CachedScheduleRow(
      userId: data.userId.present ? data.userId.value : this.userId,
      rangeKey: data.rangeKey.present ? data.rangeKey.value : this.rangeKey,
      payloadJson: data.payloadJson.present
          ? data.payloadJson.value
          : this.payloadJson,
      cachedAt: data.cachedAt.present ? data.cachedAt.value : this.cachedAt,
    );
  }

  @override
  String toString() {
    return (StringBuffer('CachedScheduleRow(')
          ..write('userId: $userId, ')
          ..write('rangeKey: $rangeKey, ')
          ..write('payloadJson: $payloadJson, ')
          ..write('cachedAt: $cachedAt')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(userId, rangeKey, payloadJson, cachedAt);
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is CachedScheduleRow &&
          other.userId == this.userId &&
          other.rangeKey == this.rangeKey &&
          other.payloadJson == this.payloadJson &&
          other.cachedAt == this.cachedAt);
}

class CachedSchedulesCompanion extends UpdateCompanion<CachedScheduleRow> {
  final Value<String> userId;
  final Value<String> rangeKey;
  final Value<String> payloadJson;
  final Value<DateTime> cachedAt;
  final Value<int> rowid;
  const CachedSchedulesCompanion({
    this.userId = const Value.absent(),
    this.rangeKey = const Value.absent(),
    this.payloadJson = const Value.absent(),
    this.cachedAt = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  CachedSchedulesCompanion.insert({
    required String userId,
    required String rangeKey,
    required String payloadJson,
    required DateTime cachedAt,
    this.rowid = const Value.absent(),
  }) : userId = Value(userId),
       rangeKey = Value(rangeKey),
       payloadJson = Value(payloadJson),
       cachedAt = Value(cachedAt);
  static Insertable<CachedScheduleRow> custom({
    Expression<String>? userId,
    Expression<String>? rangeKey,
    Expression<String>? payloadJson,
    Expression<DateTime>? cachedAt,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (userId != null) 'user_id': userId,
      if (rangeKey != null) 'range_key': rangeKey,
      if (payloadJson != null) 'payload_json': payloadJson,
      if (cachedAt != null) 'cached_at': cachedAt,
      if (rowid != null) 'rowid': rowid,
    });
  }

  CachedSchedulesCompanion copyWith({
    Value<String>? userId,
    Value<String>? rangeKey,
    Value<String>? payloadJson,
    Value<DateTime>? cachedAt,
    Value<int>? rowid,
  }) {
    return CachedSchedulesCompanion(
      userId: userId ?? this.userId,
      rangeKey: rangeKey ?? this.rangeKey,
      payloadJson: payloadJson ?? this.payloadJson,
      cachedAt: cachedAt ?? this.cachedAt,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (userId.present) {
      map['user_id'] = Variable<String>(userId.value);
    }
    if (rangeKey.present) {
      map['range_key'] = Variable<String>(rangeKey.value);
    }
    if (payloadJson.present) {
      map['payload_json'] = Variable<String>(payloadJson.value);
    }
    if (cachedAt.present) {
      map['cached_at'] = Variable<DateTime>(cachedAt.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('CachedSchedulesCompanion(')
          ..write('userId: $userId, ')
          ..write('rangeKey: $rangeKey, ')
          ..write('payloadJson: $payloadJson, ')
          ..write('cachedAt: $cachedAt, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $CachedSessionsTable extends CachedSessions
    with TableInfo<$CachedSessionsTable, CachedSessionRow> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $CachedSessionsTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _userIdMeta = const VerificationMeta('userId');
  @override
  late final GeneratedColumn<String> userId = GeneratedColumn<String>(
    'user_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _idMeta = const VerificationMeta('id');
  @override
  late final GeneratedColumn<String> id = GeneratedColumn<String>(
    'id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _sectionIdMeta = const VerificationMeta(
    'sectionId',
  );
  @override
  late final GeneratedColumn<String> sectionId = GeneratedColumn<String>(
    'section_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _payloadJsonMeta = const VerificationMeta(
    'payloadJson',
  );
  @override
  late final GeneratedColumn<String> payloadJson = GeneratedColumn<String>(
    'payload_json',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _cachedAtMeta = const VerificationMeta(
    'cachedAt',
  );
  @override
  late final GeneratedColumn<DateTime> cachedAt = GeneratedColumn<DateTime>(
    'cached_at',
    aliasedName,
    false,
    type: DriftSqlType.dateTime,
    requiredDuringInsert: true,
  );
  @override
  List<GeneratedColumn> get $columns => [
    userId,
    id,
    sectionId,
    payloadJson,
    cachedAt,
  ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'cached_sessions';
  @override
  VerificationContext validateIntegrity(
    Insertable<CachedSessionRow> instance, {
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
    if (data.containsKey('id')) {
      context.handle(_idMeta, id.isAcceptableOrUnknown(data['id']!, _idMeta));
    } else if (isInserting) {
      context.missing(_idMeta);
    }
    if (data.containsKey('section_id')) {
      context.handle(
        _sectionIdMeta,
        sectionId.isAcceptableOrUnknown(data['section_id']!, _sectionIdMeta),
      );
    } else if (isInserting) {
      context.missing(_sectionIdMeta);
    }
    if (data.containsKey('payload_json')) {
      context.handle(
        _payloadJsonMeta,
        payloadJson.isAcceptableOrUnknown(
          data['payload_json']!,
          _payloadJsonMeta,
        ),
      );
    } else if (isInserting) {
      context.missing(_payloadJsonMeta);
    }
    if (data.containsKey('cached_at')) {
      context.handle(
        _cachedAtMeta,
        cachedAt.isAcceptableOrUnknown(data['cached_at']!, _cachedAtMeta),
      );
    } else if (isInserting) {
      context.missing(_cachedAtMeta);
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {userId, id};
  @override
  CachedSessionRow map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return CachedSessionRow(
      userId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}user_id'],
      )!,
      id: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}id'],
      )!,
      sectionId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}section_id'],
      )!,
      payloadJson: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}payload_json'],
      )!,
      cachedAt: attachedDatabase.typeMapping.read(
        DriftSqlType.dateTime,
        data['${effectivePrefix}cached_at'],
      )!,
    );
  }

  @override
  $CachedSessionsTable createAlias(String alias) {
    return $CachedSessionsTable(attachedDatabase, alias);
  }
}

class CachedSessionRow extends DataClass
    implements Insertable<CachedSessionRow> {
  final String userId;
  final String id;
  final String sectionId;
  final String payloadJson;
  final DateTime cachedAt;
  const CachedSessionRow({
    required this.userId,
    required this.id,
    required this.sectionId,
    required this.payloadJson,
    required this.cachedAt,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['user_id'] = Variable<String>(userId);
    map['id'] = Variable<String>(id);
    map['section_id'] = Variable<String>(sectionId);
    map['payload_json'] = Variable<String>(payloadJson);
    map['cached_at'] = Variable<DateTime>(cachedAt);
    return map;
  }

  CachedSessionsCompanion toCompanion(bool nullToAbsent) {
    return CachedSessionsCompanion(
      userId: Value(userId),
      id: Value(id),
      sectionId: Value(sectionId),
      payloadJson: Value(payloadJson),
      cachedAt: Value(cachedAt),
    );
  }

  factory CachedSessionRow.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return CachedSessionRow(
      userId: serializer.fromJson<String>(json['userId']),
      id: serializer.fromJson<String>(json['id']),
      sectionId: serializer.fromJson<String>(json['sectionId']),
      payloadJson: serializer.fromJson<String>(json['payloadJson']),
      cachedAt: serializer.fromJson<DateTime>(json['cachedAt']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'userId': serializer.toJson<String>(userId),
      'id': serializer.toJson<String>(id),
      'sectionId': serializer.toJson<String>(sectionId),
      'payloadJson': serializer.toJson<String>(payloadJson),
      'cachedAt': serializer.toJson<DateTime>(cachedAt),
    };
  }

  CachedSessionRow copyWith({
    String? userId,
    String? id,
    String? sectionId,
    String? payloadJson,
    DateTime? cachedAt,
  }) => CachedSessionRow(
    userId: userId ?? this.userId,
    id: id ?? this.id,
    sectionId: sectionId ?? this.sectionId,
    payloadJson: payloadJson ?? this.payloadJson,
    cachedAt: cachedAt ?? this.cachedAt,
  );
  CachedSessionRow copyWithCompanion(CachedSessionsCompanion data) {
    return CachedSessionRow(
      userId: data.userId.present ? data.userId.value : this.userId,
      id: data.id.present ? data.id.value : this.id,
      sectionId: data.sectionId.present ? data.sectionId.value : this.sectionId,
      payloadJson: data.payloadJson.present
          ? data.payloadJson.value
          : this.payloadJson,
      cachedAt: data.cachedAt.present ? data.cachedAt.value : this.cachedAt,
    );
  }

  @override
  String toString() {
    return (StringBuffer('CachedSessionRow(')
          ..write('userId: $userId, ')
          ..write('id: $id, ')
          ..write('sectionId: $sectionId, ')
          ..write('payloadJson: $payloadJson, ')
          ..write('cachedAt: $cachedAt')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(userId, id, sectionId, payloadJson, cachedAt);
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is CachedSessionRow &&
          other.userId == this.userId &&
          other.id == this.id &&
          other.sectionId == this.sectionId &&
          other.payloadJson == this.payloadJson &&
          other.cachedAt == this.cachedAt);
}

class CachedSessionsCompanion extends UpdateCompanion<CachedSessionRow> {
  final Value<String> userId;
  final Value<String> id;
  final Value<String> sectionId;
  final Value<String> payloadJson;
  final Value<DateTime> cachedAt;
  final Value<int> rowid;
  const CachedSessionsCompanion({
    this.userId = const Value.absent(),
    this.id = const Value.absent(),
    this.sectionId = const Value.absent(),
    this.payloadJson = const Value.absent(),
    this.cachedAt = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  CachedSessionsCompanion.insert({
    required String userId,
    required String id,
    required String sectionId,
    required String payloadJson,
    required DateTime cachedAt,
    this.rowid = const Value.absent(),
  }) : userId = Value(userId),
       id = Value(id),
       sectionId = Value(sectionId),
       payloadJson = Value(payloadJson),
       cachedAt = Value(cachedAt);
  static Insertable<CachedSessionRow> custom({
    Expression<String>? userId,
    Expression<String>? id,
    Expression<String>? sectionId,
    Expression<String>? payloadJson,
    Expression<DateTime>? cachedAt,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (userId != null) 'user_id': userId,
      if (id != null) 'id': id,
      if (sectionId != null) 'section_id': sectionId,
      if (payloadJson != null) 'payload_json': payloadJson,
      if (cachedAt != null) 'cached_at': cachedAt,
      if (rowid != null) 'rowid': rowid,
    });
  }

  CachedSessionsCompanion copyWith({
    Value<String>? userId,
    Value<String>? id,
    Value<String>? sectionId,
    Value<String>? payloadJson,
    Value<DateTime>? cachedAt,
    Value<int>? rowid,
  }) {
    return CachedSessionsCompanion(
      userId: userId ?? this.userId,
      id: id ?? this.id,
      sectionId: sectionId ?? this.sectionId,
      payloadJson: payloadJson ?? this.payloadJson,
      cachedAt: cachedAt ?? this.cachedAt,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (userId.present) {
      map['user_id'] = Variable<String>(userId.value);
    }
    if (id.present) {
      map['id'] = Variable<String>(id.value);
    }
    if (sectionId.present) {
      map['section_id'] = Variable<String>(sectionId.value);
    }
    if (payloadJson.present) {
      map['payload_json'] = Variable<String>(payloadJson.value);
    }
    if (cachedAt.present) {
      map['cached_at'] = Variable<DateTime>(cachedAt.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('CachedSessionsCompanion(')
          ..write('userId: $userId, ')
          ..write('id: $id, ')
          ..write('sectionId: $sectionId, ')
          ..write('payloadJson: $payloadJson, ')
          ..write('cachedAt: $cachedAt, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $CachedRostersTable extends CachedRosters
    with TableInfo<$CachedRostersTable, CachedRosterRow> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $CachedRostersTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _userIdMeta = const VerificationMeta('userId');
  @override
  late final GeneratedColumn<String> userId = GeneratedColumn<String>(
    'user_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _sectionIdMeta = const VerificationMeta(
    'sectionId',
  );
  @override
  late final GeneratedColumn<String> sectionId = GeneratedColumn<String>(
    'section_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _studentIdMeta = const VerificationMeta(
    'studentId',
  );
  @override
  late final GeneratedColumn<String> studentId = GeneratedColumn<String>(
    'student_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _payloadJsonMeta = const VerificationMeta(
    'payloadJson',
  );
  @override
  late final GeneratedColumn<String> payloadJson = GeneratedColumn<String>(
    'payload_json',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _cachedAtMeta = const VerificationMeta(
    'cachedAt',
  );
  @override
  late final GeneratedColumn<DateTime> cachedAt = GeneratedColumn<DateTime>(
    'cached_at',
    aliasedName,
    false,
    type: DriftSqlType.dateTime,
    requiredDuringInsert: true,
  );
  @override
  List<GeneratedColumn> get $columns => [
    userId,
    sectionId,
    studentId,
    payloadJson,
    cachedAt,
  ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'cached_rosters';
  @override
  VerificationContext validateIntegrity(
    Insertable<CachedRosterRow> instance, {
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
    if (data.containsKey('section_id')) {
      context.handle(
        _sectionIdMeta,
        sectionId.isAcceptableOrUnknown(data['section_id']!, _sectionIdMeta),
      );
    } else if (isInserting) {
      context.missing(_sectionIdMeta);
    }
    if (data.containsKey('student_id')) {
      context.handle(
        _studentIdMeta,
        studentId.isAcceptableOrUnknown(data['student_id']!, _studentIdMeta),
      );
    } else if (isInserting) {
      context.missing(_studentIdMeta);
    }
    if (data.containsKey('payload_json')) {
      context.handle(
        _payloadJsonMeta,
        payloadJson.isAcceptableOrUnknown(
          data['payload_json']!,
          _payloadJsonMeta,
        ),
      );
    } else if (isInserting) {
      context.missing(_payloadJsonMeta);
    }
    if (data.containsKey('cached_at')) {
      context.handle(
        _cachedAtMeta,
        cachedAt.isAcceptableOrUnknown(data['cached_at']!, _cachedAtMeta),
      );
    } else if (isInserting) {
      context.missing(_cachedAtMeta);
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {userId, sectionId, studentId};
  @override
  CachedRosterRow map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return CachedRosterRow(
      userId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}user_id'],
      )!,
      sectionId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}section_id'],
      )!,
      studentId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}student_id'],
      )!,
      payloadJson: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}payload_json'],
      )!,
      cachedAt: attachedDatabase.typeMapping.read(
        DriftSqlType.dateTime,
        data['${effectivePrefix}cached_at'],
      )!,
    );
  }

  @override
  $CachedRostersTable createAlias(String alias) {
    return $CachedRostersTable(attachedDatabase, alias);
  }
}

class CachedRosterRow extends DataClass implements Insertable<CachedRosterRow> {
  final String userId;
  final String sectionId;
  final String studentId;
  final String payloadJson;
  final DateTime cachedAt;
  const CachedRosterRow({
    required this.userId,
    required this.sectionId,
    required this.studentId,
    required this.payloadJson,
    required this.cachedAt,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['user_id'] = Variable<String>(userId);
    map['section_id'] = Variable<String>(sectionId);
    map['student_id'] = Variable<String>(studentId);
    map['payload_json'] = Variable<String>(payloadJson);
    map['cached_at'] = Variable<DateTime>(cachedAt);
    return map;
  }

  CachedRostersCompanion toCompanion(bool nullToAbsent) {
    return CachedRostersCompanion(
      userId: Value(userId),
      sectionId: Value(sectionId),
      studentId: Value(studentId),
      payloadJson: Value(payloadJson),
      cachedAt: Value(cachedAt),
    );
  }

  factory CachedRosterRow.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return CachedRosterRow(
      userId: serializer.fromJson<String>(json['userId']),
      sectionId: serializer.fromJson<String>(json['sectionId']),
      studentId: serializer.fromJson<String>(json['studentId']),
      payloadJson: serializer.fromJson<String>(json['payloadJson']),
      cachedAt: serializer.fromJson<DateTime>(json['cachedAt']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'userId': serializer.toJson<String>(userId),
      'sectionId': serializer.toJson<String>(sectionId),
      'studentId': serializer.toJson<String>(studentId),
      'payloadJson': serializer.toJson<String>(payloadJson),
      'cachedAt': serializer.toJson<DateTime>(cachedAt),
    };
  }

  CachedRosterRow copyWith({
    String? userId,
    String? sectionId,
    String? studentId,
    String? payloadJson,
    DateTime? cachedAt,
  }) => CachedRosterRow(
    userId: userId ?? this.userId,
    sectionId: sectionId ?? this.sectionId,
    studentId: studentId ?? this.studentId,
    payloadJson: payloadJson ?? this.payloadJson,
    cachedAt: cachedAt ?? this.cachedAt,
  );
  CachedRosterRow copyWithCompanion(CachedRostersCompanion data) {
    return CachedRosterRow(
      userId: data.userId.present ? data.userId.value : this.userId,
      sectionId: data.sectionId.present ? data.sectionId.value : this.sectionId,
      studentId: data.studentId.present ? data.studentId.value : this.studentId,
      payloadJson: data.payloadJson.present
          ? data.payloadJson.value
          : this.payloadJson,
      cachedAt: data.cachedAt.present ? data.cachedAt.value : this.cachedAt,
    );
  }

  @override
  String toString() {
    return (StringBuffer('CachedRosterRow(')
          ..write('userId: $userId, ')
          ..write('sectionId: $sectionId, ')
          ..write('studentId: $studentId, ')
          ..write('payloadJson: $payloadJson, ')
          ..write('cachedAt: $cachedAt')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode =>
      Object.hash(userId, sectionId, studentId, payloadJson, cachedAt);
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is CachedRosterRow &&
          other.userId == this.userId &&
          other.sectionId == this.sectionId &&
          other.studentId == this.studentId &&
          other.payloadJson == this.payloadJson &&
          other.cachedAt == this.cachedAt);
}

class CachedRostersCompanion extends UpdateCompanion<CachedRosterRow> {
  final Value<String> userId;
  final Value<String> sectionId;
  final Value<String> studentId;
  final Value<String> payloadJson;
  final Value<DateTime> cachedAt;
  final Value<int> rowid;
  const CachedRostersCompanion({
    this.userId = const Value.absent(),
    this.sectionId = const Value.absent(),
    this.studentId = const Value.absent(),
    this.payloadJson = const Value.absent(),
    this.cachedAt = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  CachedRostersCompanion.insert({
    required String userId,
    required String sectionId,
    required String studentId,
    required String payloadJson,
    required DateTime cachedAt,
    this.rowid = const Value.absent(),
  }) : userId = Value(userId),
       sectionId = Value(sectionId),
       studentId = Value(studentId),
       payloadJson = Value(payloadJson),
       cachedAt = Value(cachedAt);
  static Insertable<CachedRosterRow> custom({
    Expression<String>? userId,
    Expression<String>? sectionId,
    Expression<String>? studentId,
    Expression<String>? payloadJson,
    Expression<DateTime>? cachedAt,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (userId != null) 'user_id': userId,
      if (sectionId != null) 'section_id': sectionId,
      if (studentId != null) 'student_id': studentId,
      if (payloadJson != null) 'payload_json': payloadJson,
      if (cachedAt != null) 'cached_at': cachedAt,
      if (rowid != null) 'rowid': rowid,
    });
  }

  CachedRostersCompanion copyWith({
    Value<String>? userId,
    Value<String>? sectionId,
    Value<String>? studentId,
    Value<String>? payloadJson,
    Value<DateTime>? cachedAt,
    Value<int>? rowid,
  }) {
    return CachedRostersCompanion(
      userId: userId ?? this.userId,
      sectionId: sectionId ?? this.sectionId,
      studentId: studentId ?? this.studentId,
      payloadJson: payloadJson ?? this.payloadJson,
      cachedAt: cachedAt ?? this.cachedAt,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (userId.present) {
      map['user_id'] = Variable<String>(userId.value);
    }
    if (sectionId.present) {
      map['section_id'] = Variable<String>(sectionId.value);
    }
    if (studentId.present) {
      map['student_id'] = Variable<String>(studentId.value);
    }
    if (payloadJson.present) {
      map['payload_json'] = Variable<String>(payloadJson.value);
    }
    if (cachedAt.present) {
      map['cached_at'] = Variable<DateTime>(cachedAt.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('CachedRostersCompanion(')
          ..write('userId: $userId, ')
          ..write('sectionId: $sectionId, ')
          ..write('studentId: $studentId, ')
          ..write('payloadJson: $payloadJson, ')
          ..write('cachedAt: $cachedAt, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $CachedAttendanceTable extends CachedAttendance
    with TableInfo<$CachedAttendanceTable, CachedAttendanceRow> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $CachedAttendanceTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _userIdMeta = const VerificationMeta('userId');
  @override
  late final GeneratedColumn<String> userId = GeneratedColumn<String>(
    'user_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _idMeta = const VerificationMeta('id');
  @override
  late final GeneratedColumn<String> id = GeneratedColumn<String>(
    'id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _studentIdMeta = const VerificationMeta(
    'studentId',
  );
  @override
  late final GeneratedColumn<String> studentId = GeneratedColumn<String>(
    'student_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _sectionIdMeta = const VerificationMeta(
    'sectionId',
  );
  @override
  late final GeneratedColumn<String> sectionId = GeneratedColumn<String>(
    'section_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _sessionIdMeta = const VerificationMeta(
    'sessionId',
  );
  @override
  late final GeneratedColumn<String> sessionId = GeneratedColumn<String>(
    'session_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _isSyncedMeta = const VerificationMeta(
    'isSynced',
  );
  @override
  late final GeneratedColumn<bool> isSynced = GeneratedColumn<bool>(
    'is_synced',
    aliasedName,
    false,
    type: DriftSqlType.bool,
    requiredDuringInsert: false,
    defaultConstraints: GeneratedColumn.constraintIsAlways(
      'CHECK ("is_synced" IN (0, 1))',
    ),
    defaultValue: const Constant(true),
  );
  static const VerificationMeta _payloadJsonMeta = const VerificationMeta(
    'payloadJson',
  );
  @override
  late final GeneratedColumn<String> payloadJson = GeneratedColumn<String>(
    'payload_json',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _cachedAtMeta = const VerificationMeta(
    'cachedAt',
  );
  @override
  late final GeneratedColumn<DateTime> cachedAt = GeneratedColumn<DateTime>(
    'cached_at',
    aliasedName,
    false,
    type: DriftSqlType.dateTime,
    requiredDuringInsert: true,
  );
  @override
  List<GeneratedColumn> get $columns => [
    userId,
    id,
    studentId,
    sectionId,
    sessionId,
    isSynced,
    payloadJson,
    cachedAt,
  ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'cached_attendance';
  @override
  VerificationContext validateIntegrity(
    Insertable<CachedAttendanceRow> instance, {
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
    if (data.containsKey('id')) {
      context.handle(_idMeta, id.isAcceptableOrUnknown(data['id']!, _idMeta));
    } else if (isInserting) {
      context.missing(_idMeta);
    }
    if (data.containsKey('student_id')) {
      context.handle(
        _studentIdMeta,
        studentId.isAcceptableOrUnknown(data['student_id']!, _studentIdMeta),
      );
    } else if (isInserting) {
      context.missing(_studentIdMeta);
    }
    if (data.containsKey('section_id')) {
      context.handle(
        _sectionIdMeta,
        sectionId.isAcceptableOrUnknown(data['section_id']!, _sectionIdMeta),
      );
    } else if (isInserting) {
      context.missing(_sectionIdMeta);
    }
    if (data.containsKey('session_id')) {
      context.handle(
        _sessionIdMeta,
        sessionId.isAcceptableOrUnknown(data['session_id']!, _sessionIdMeta),
      );
    } else if (isInserting) {
      context.missing(_sessionIdMeta);
    }
    if (data.containsKey('is_synced')) {
      context.handle(
        _isSyncedMeta,
        isSynced.isAcceptableOrUnknown(data['is_synced']!, _isSyncedMeta),
      );
    }
    if (data.containsKey('payload_json')) {
      context.handle(
        _payloadJsonMeta,
        payloadJson.isAcceptableOrUnknown(
          data['payload_json']!,
          _payloadJsonMeta,
        ),
      );
    } else if (isInserting) {
      context.missing(_payloadJsonMeta);
    }
    if (data.containsKey('cached_at')) {
      context.handle(
        _cachedAtMeta,
        cachedAt.isAcceptableOrUnknown(data['cached_at']!, _cachedAtMeta),
      );
    } else if (isInserting) {
      context.missing(_cachedAtMeta);
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {userId, id};
  @override
  CachedAttendanceRow map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return CachedAttendanceRow(
      userId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}user_id'],
      )!,
      id: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}id'],
      )!,
      studentId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}student_id'],
      )!,
      sectionId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}section_id'],
      )!,
      sessionId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}session_id'],
      )!,
      isSynced: attachedDatabase.typeMapping.read(
        DriftSqlType.bool,
        data['${effectivePrefix}is_synced'],
      )!,
      payloadJson: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}payload_json'],
      )!,
      cachedAt: attachedDatabase.typeMapping.read(
        DriftSqlType.dateTime,
        data['${effectivePrefix}cached_at'],
      )!,
    );
  }

  @override
  $CachedAttendanceTable createAlias(String alias) {
    return $CachedAttendanceTable(attachedDatabase, alias);
  }
}

class CachedAttendanceRow extends DataClass
    implements Insertable<CachedAttendanceRow> {
  final String userId;
  final String id;
  final String studentId;
  final String sectionId;
  final String sessionId;
  final bool isSynced;
  final String payloadJson;
  final DateTime cachedAt;
  const CachedAttendanceRow({
    required this.userId,
    required this.id,
    required this.studentId,
    required this.sectionId,
    required this.sessionId,
    required this.isSynced,
    required this.payloadJson,
    required this.cachedAt,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['user_id'] = Variable<String>(userId);
    map['id'] = Variable<String>(id);
    map['student_id'] = Variable<String>(studentId);
    map['section_id'] = Variable<String>(sectionId);
    map['session_id'] = Variable<String>(sessionId);
    map['is_synced'] = Variable<bool>(isSynced);
    map['payload_json'] = Variable<String>(payloadJson);
    map['cached_at'] = Variable<DateTime>(cachedAt);
    return map;
  }

  CachedAttendanceCompanion toCompanion(bool nullToAbsent) {
    return CachedAttendanceCompanion(
      userId: Value(userId),
      id: Value(id),
      studentId: Value(studentId),
      sectionId: Value(sectionId),
      sessionId: Value(sessionId),
      isSynced: Value(isSynced),
      payloadJson: Value(payloadJson),
      cachedAt: Value(cachedAt),
    );
  }

  factory CachedAttendanceRow.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return CachedAttendanceRow(
      userId: serializer.fromJson<String>(json['userId']),
      id: serializer.fromJson<String>(json['id']),
      studentId: serializer.fromJson<String>(json['studentId']),
      sectionId: serializer.fromJson<String>(json['sectionId']),
      sessionId: serializer.fromJson<String>(json['sessionId']),
      isSynced: serializer.fromJson<bool>(json['isSynced']),
      payloadJson: serializer.fromJson<String>(json['payloadJson']),
      cachedAt: serializer.fromJson<DateTime>(json['cachedAt']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'userId': serializer.toJson<String>(userId),
      'id': serializer.toJson<String>(id),
      'studentId': serializer.toJson<String>(studentId),
      'sectionId': serializer.toJson<String>(sectionId),
      'sessionId': serializer.toJson<String>(sessionId),
      'isSynced': serializer.toJson<bool>(isSynced),
      'payloadJson': serializer.toJson<String>(payloadJson),
      'cachedAt': serializer.toJson<DateTime>(cachedAt),
    };
  }

  CachedAttendanceRow copyWith({
    String? userId,
    String? id,
    String? studentId,
    String? sectionId,
    String? sessionId,
    bool? isSynced,
    String? payloadJson,
    DateTime? cachedAt,
  }) => CachedAttendanceRow(
    userId: userId ?? this.userId,
    id: id ?? this.id,
    studentId: studentId ?? this.studentId,
    sectionId: sectionId ?? this.sectionId,
    sessionId: sessionId ?? this.sessionId,
    isSynced: isSynced ?? this.isSynced,
    payloadJson: payloadJson ?? this.payloadJson,
    cachedAt: cachedAt ?? this.cachedAt,
  );
  CachedAttendanceRow copyWithCompanion(CachedAttendanceCompanion data) {
    return CachedAttendanceRow(
      userId: data.userId.present ? data.userId.value : this.userId,
      id: data.id.present ? data.id.value : this.id,
      studentId: data.studentId.present ? data.studentId.value : this.studentId,
      sectionId: data.sectionId.present ? data.sectionId.value : this.sectionId,
      sessionId: data.sessionId.present ? data.sessionId.value : this.sessionId,
      isSynced: data.isSynced.present ? data.isSynced.value : this.isSynced,
      payloadJson: data.payloadJson.present
          ? data.payloadJson.value
          : this.payloadJson,
      cachedAt: data.cachedAt.present ? data.cachedAt.value : this.cachedAt,
    );
  }

  @override
  String toString() {
    return (StringBuffer('CachedAttendanceRow(')
          ..write('userId: $userId, ')
          ..write('id: $id, ')
          ..write('studentId: $studentId, ')
          ..write('sectionId: $sectionId, ')
          ..write('sessionId: $sessionId, ')
          ..write('isSynced: $isSynced, ')
          ..write('payloadJson: $payloadJson, ')
          ..write('cachedAt: $cachedAt')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(
    userId,
    id,
    studentId,
    sectionId,
    sessionId,
    isSynced,
    payloadJson,
    cachedAt,
  );
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is CachedAttendanceRow &&
          other.userId == this.userId &&
          other.id == this.id &&
          other.studentId == this.studentId &&
          other.sectionId == this.sectionId &&
          other.sessionId == this.sessionId &&
          other.isSynced == this.isSynced &&
          other.payloadJson == this.payloadJson &&
          other.cachedAt == this.cachedAt);
}

class CachedAttendanceCompanion extends UpdateCompanion<CachedAttendanceRow> {
  final Value<String> userId;
  final Value<String> id;
  final Value<String> studentId;
  final Value<String> sectionId;
  final Value<String> sessionId;
  final Value<bool> isSynced;
  final Value<String> payloadJson;
  final Value<DateTime> cachedAt;
  final Value<int> rowid;
  const CachedAttendanceCompanion({
    this.userId = const Value.absent(),
    this.id = const Value.absent(),
    this.studentId = const Value.absent(),
    this.sectionId = const Value.absent(),
    this.sessionId = const Value.absent(),
    this.isSynced = const Value.absent(),
    this.payloadJson = const Value.absent(),
    this.cachedAt = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  CachedAttendanceCompanion.insert({
    required String userId,
    required String id,
    required String studentId,
    required String sectionId,
    required String sessionId,
    this.isSynced = const Value.absent(),
    required String payloadJson,
    required DateTime cachedAt,
    this.rowid = const Value.absent(),
  }) : userId = Value(userId),
       id = Value(id),
       studentId = Value(studentId),
       sectionId = Value(sectionId),
       sessionId = Value(sessionId),
       payloadJson = Value(payloadJson),
       cachedAt = Value(cachedAt);
  static Insertable<CachedAttendanceRow> custom({
    Expression<String>? userId,
    Expression<String>? id,
    Expression<String>? studentId,
    Expression<String>? sectionId,
    Expression<String>? sessionId,
    Expression<bool>? isSynced,
    Expression<String>? payloadJson,
    Expression<DateTime>? cachedAt,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (userId != null) 'user_id': userId,
      if (id != null) 'id': id,
      if (studentId != null) 'student_id': studentId,
      if (sectionId != null) 'section_id': sectionId,
      if (sessionId != null) 'session_id': sessionId,
      if (isSynced != null) 'is_synced': isSynced,
      if (payloadJson != null) 'payload_json': payloadJson,
      if (cachedAt != null) 'cached_at': cachedAt,
      if (rowid != null) 'rowid': rowid,
    });
  }

  CachedAttendanceCompanion copyWith({
    Value<String>? userId,
    Value<String>? id,
    Value<String>? studentId,
    Value<String>? sectionId,
    Value<String>? sessionId,
    Value<bool>? isSynced,
    Value<String>? payloadJson,
    Value<DateTime>? cachedAt,
    Value<int>? rowid,
  }) {
    return CachedAttendanceCompanion(
      userId: userId ?? this.userId,
      id: id ?? this.id,
      studentId: studentId ?? this.studentId,
      sectionId: sectionId ?? this.sectionId,
      sessionId: sessionId ?? this.sessionId,
      isSynced: isSynced ?? this.isSynced,
      payloadJson: payloadJson ?? this.payloadJson,
      cachedAt: cachedAt ?? this.cachedAt,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (userId.present) {
      map['user_id'] = Variable<String>(userId.value);
    }
    if (id.present) {
      map['id'] = Variable<String>(id.value);
    }
    if (studentId.present) {
      map['student_id'] = Variable<String>(studentId.value);
    }
    if (sectionId.present) {
      map['section_id'] = Variable<String>(sectionId.value);
    }
    if (sessionId.present) {
      map['session_id'] = Variable<String>(sessionId.value);
    }
    if (isSynced.present) {
      map['is_synced'] = Variable<bool>(isSynced.value);
    }
    if (payloadJson.present) {
      map['payload_json'] = Variable<String>(payloadJson.value);
    }
    if (cachedAt.present) {
      map['cached_at'] = Variable<DateTime>(cachedAt.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('CachedAttendanceCompanion(')
          ..write('userId: $userId, ')
          ..write('id: $id, ')
          ..write('studentId: $studentId, ')
          ..write('sectionId: $sectionId, ')
          ..write('sessionId: $sessionId, ')
          ..write('isSynced: $isSynced, ')
          ..write('payloadJson: $payloadJson, ')
          ..write('cachedAt: $cachedAt, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $OfflineAttendanceQueueTable extends OfflineAttendanceQueue
    with TableInfo<$OfflineAttendanceQueueTable, OfflineAttendanceQueueRow> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $OfflineAttendanceQueueTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _clientReceiptIdMeta = const VerificationMeta(
    'clientReceiptId',
  );
  @override
  late final GeneratedColumn<String> clientReceiptId = GeneratedColumn<String>(
    'client_receipt_id',
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
  static const VerificationMeta _sessionIdMeta = const VerificationMeta(
    'sessionId',
  );
  @override
  late final GeneratedColumn<String> sessionId = GeneratedColumn<String>(
    'session_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _studentIdMeta = const VerificationMeta(
    'studentId',
  );
  @override
  late final GeneratedColumn<String> studentId = GeneratedColumn<String>(
    'student_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _scannedTokenMeta = const VerificationMeta(
    'scannedToken',
  );
  @override
  late final GeneratedColumn<String> scannedToken = GeneratedColumn<String>(
    'scanned_token',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _checkpointMeta = const VerificationMeta(
    'checkpoint',
  );
  @override
  late final GeneratedColumn<String> checkpoint = GeneratedColumn<String>(
    'checkpoint',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _pinHashMeta = const VerificationMeta(
    'pinHash',
  );
  @override
  late final GeneratedColumn<String> pinHash = GeneratedColumn<String>(
    'pin_hash',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _pinEncryptedMeta = const VerificationMeta(
    'pinEncrypted',
  );
  @override
  late final GeneratedColumn<String> pinEncrypted = GeneratedColumn<String>(
    'pin_encrypted',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _latitudeMeta = const VerificationMeta(
    'latitude',
  );
  @override
  late final GeneratedColumn<double> latitude = GeneratedColumn<double>(
    'latitude',
    aliasedName,
    true,
    type: DriftSqlType.double,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _longitudeMeta = const VerificationMeta(
    'longitude',
  );
  @override
  late final GeneratedColumn<double> longitude = GeneratedColumn<double>(
    'longitude',
    aliasedName,
    true,
    type: DriftSqlType.double,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _accuracyMeta = const VerificationMeta(
    'accuracy',
  );
  @override
  late final GeneratedColumn<double> accuracy = GeneratedColumn<double>(
    'accuracy',
    aliasedName,
    true,
    type: DriftSqlType.double,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _locationCapturedAtMeta =
      const VerificationMeta('locationCapturedAt');
  @override
  late final GeneratedColumn<DateTime> locationCapturedAt =
      GeneratedColumn<DateTime>(
        'location_captured_at',
        aliasedName,
        true,
        type: DriftSqlType.dateTime,
        requiredDuringInsert: false,
      );
  static const VerificationMeta _haversineDistanceMeta = const VerificationMeta(
    'haversineDistance',
  );
  @override
  late final GeneratedColumn<double> haversineDistance =
      GeneratedColumn<double>(
        'haversine_distance',
        aliasedName,
        true,
        type: DriftSqlType.double,
        requiredDuringInsert: false,
      );
  static const VerificationMeta _isMockedMeta = const VerificationMeta(
    'isMocked',
  );
  @override
  late final GeneratedColumn<bool> isMocked = GeneratedColumn<bool>(
    'is_mocked',
    aliasedName,
    false,
    type: DriftSqlType.bool,
    requiredDuringInsert: false,
    defaultConstraints: GeneratedColumn.constraintIsAlways(
      'CHECK ("is_mocked" IN (0, 1))',
    ),
    defaultValue: const Constant(false),
  );
  static const VerificationMeta _inputChannelMeta = const VerificationMeta(
    'inputChannel',
  );
  @override
  late final GeneratedColumn<String> inputChannel = GeneratedColumn<String>(
    'input_channel',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _scannedAtUtcMeta = const VerificationMeta(
    'scannedAtUtc',
  );
  @override
  late final GeneratedColumn<DateTime> scannedAtUtc = GeneratedColumn<DateTime>(
    'scanned_at_utc',
    aliasedName,
    false,
    type: DriftSqlType.dateTime,
    requiredDuringInsert: true,
  );
  @override
  late final GeneratedColumnWithTypeConverter<AttendanceSyncStatus, String>
  syncStatus =
      GeneratedColumn<String>(
        'sync_status',
        aliasedName,
        false,
        type: DriftSqlType.string,
        requiredDuringInsert: true,
      ).withConverter<AttendanceSyncStatus>(
        $OfflineAttendanceQueueTable.$convertersyncStatus,
      );
  static const VerificationMeta _serverErrorMeta = const VerificationMeta(
    'serverError',
  );
  @override
  late final GeneratedColumn<String> serverError = GeneratedColumn<String>(
    'server_error',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _retryCountMeta = const VerificationMeta(
    'retryCount',
  );
  @override
  late final GeneratedColumn<int> retryCount = GeneratedColumn<int>(
    'retry_count',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
    defaultValue: const Constant(0),
  );
  static const VerificationMeta _lastSentAtMeta = const VerificationMeta(
    'lastSentAt',
  );
  @override
  late final GeneratedColumn<DateTime> lastSentAt = GeneratedColumn<DateTime>(
    'last_sent_at',
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
    requiredDuringInsert: true,
  );
  @override
  List<GeneratedColumn> get $columns => [
    clientReceiptId,
    userId,
    sessionId,
    studentId,
    scannedToken,
    checkpoint,
    pinHash,
    pinEncrypted,
    latitude,
    longitude,
    accuracy,
    locationCapturedAt,
    haversineDistance,
    isMocked,
    inputChannel,
    scannedAtUtc,
    syncStatus,
    serverError,
    retryCount,
    lastSentAt,
    createdAt,
  ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'offline_attendance_queue';
  @override
  VerificationContext validateIntegrity(
    Insertable<OfflineAttendanceQueueRow> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('client_receipt_id')) {
      context.handle(
        _clientReceiptIdMeta,
        clientReceiptId.isAcceptableOrUnknown(
          data['client_receipt_id']!,
          _clientReceiptIdMeta,
        ),
      );
    } else if (isInserting) {
      context.missing(_clientReceiptIdMeta);
    }
    if (data.containsKey('user_id')) {
      context.handle(
        _userIdMeta,
        userId.isAcceptableOrUnknown(data['user_id']!, _userIdMeta),
      );
    } else if (isInserting) {
      context.missing(_userIdMeta);
    }
    if (data.containsKey('session_id')) {
      context.handle(
        _sessionIdMeta,
        sessionId.isAcceptableOrUnknown(data['session_id']!, _sessionIdMeta),
      );
    } else if (isInserting) {
      context.missing(_sessionIdMeta);
    }
    if (data.containsKey('student_id')) {
      context.handle(
        _studentIdMeta,
        studentId.isAcceptableOrUnknown(data['student_id']!, _studentIdMeta),
      );
    } else if (isInserting) {
      context.missing(_studentIdMeta);
    }
    if (data.containsKey('scanned_token')) {
      context.handle(
        _scannedTokenMeta,
        scannedToken.isAcceptableOrUnknown(
          data['scanned_token']!,
          _scannedTokenMeta,
        ),
      );
    } else if (isInserting) {
      context.missing(_scannedTokenMeta);
    }
    if (data.containsKey('checkpoint')) {
      context.handle(
        _checkpointMeta,
        checkpoint.isAcceptableOrUnknown(data['checkpoint']!, _checkpointMeta),
      );
    }
    if (data.containsKey('pin_hash')) {
      context.handle(
        _pinHashMeta,
        pinHash.isAcceptableOrUnknown(data['pin_hash']!, _pinHashMeta),
      );
    }
    if (data.containsKey('pin_encrypted')) {
      context.handle(
        _pinEncryptedMeta,
        pinEncrypted.isAcceptableOrUnknown(
          data['pin_encrypted']!,
          _pinEncryptedMeta,
        ),
      );
    }
    if (data.containsKey('latitude')) {
      context.handle(
        _latitudeMeta,
        latitude.isAcceptableOrUnknown(data['latitude']!, _latitudeMeta),
      );
    }
    if (data.containsKey('longitude')) {
      context.handle(
        _longitudeMeta,
        longitude.isAcceptableOrUnknown(data['longitude']!, _longitudeMeta),
      );
    }
    if (data.containsKey('accuracy')) {
      context.handle(
        _accuracyMeta,
        accuracy.isAcceptableOrUnknown(data['accuracy']!, _accuracyMeta),
      );
    }
    if (data.containsKey('location_captured_at')) {
      context.handle(
        _locationCapturedAtMeta,
        locationCapturedAt.isAcceptableOrUnknown(
          data['location_captured_at']!,
          _locationCapturedAtMeta,
        ),
      );
    }
    if (data.containsKey('haversine_distance')) {
      context.handle(
        _haversineDistanceMeta,
        haversineDistance.isAcceptableOrUnknown(
          data['haversine_distance']!,
          _haversineDistanceMeta,
        ),
      );
    }
    if (data.containsKey('is_mocked')) {
      context.handle(
        _isMockedMeta,
        isMocked.isAcceptableOrUnknown(data['is_mocked']!, _isMockedMeta),
      );
    }
    if (data.containsKey('input_channel')) {
      context.handle(
        _inputChannelMeta,
        inputChannel.isAcceptableOrUnknown(
          data['input_channel']!,
          _inputChannelMeta,
        ),
      );
    }
    if (data.containsKey('scanned_at_utc')) {
      context.handle(
        _scannedAtUtcMeta,
        scannedAtUtc.isAcceptableOrUnknown(
          data['scanned_at_utc']!,
          _scannedAtUtcMeta,
        ),
      );
    } else if (isInserting) {
      context.missing(_scannedAtUtcMeta);
    }
    if (data.containsKey('server_error')) {
      context.handle(
        _serverErrorMeta,
        serverError.isAcceptableOrUnknown(
          data['server_error']!,
          _serverErrorMeta,
        ),
      );
    }
    if (data.containsKey('retry_count')) {
      context.handle(
        _retryCountMeta,
        retryCount.isAcceptableOrUnknown(data['retry_count']!, _retryCountMeta),
      );
    }
    if (data.containsKey('last_sent_at')) {
      context.handle(
        _lastSentAtMeta,
        lastSentAt.isAcceptableOrUnknown(
          data['last_sent_at']!,
          _lastSentAtMeta,
        ),
      );
    }
    if (data.containsKey('created_at')) {
      context.handle(
        _createdAtMeta,
        createdAt.isAcceptableOrUnknown(data['created_at']!, _createdAtMeta),
      );
    } else if (isInserting) {
      context.missing(_createdAtMeta);
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {clientReceiptId};
  @override
  OfflineAttendanceQueueRow map(
    Map<String, dynamic> data, {
    String? tablePrefix,
  }) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return OfflineAttendanceQueueRow(
      clientReceiptId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}client_receipt_id'],
      )!,
      userId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}user_id'],
      )!,
      sessionId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}session_id'],
      )!,
      studentId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}student_id'],
      )!,
      scannedToken: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}scanned_token'],
      )!,
      checkpoint: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}checkpoint'],
      ),
      pinHash: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}pin_hash'],
      ),
      pinEncrypted: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}pin_encrypted'],
      ),
      latitude: attachedDatabase.typeMapping.read(
        DriftSqlType.double,
        data['${effectivePrefix}latitude'],
      ),
      longitude: attachedDatabase.typeMapping.read(
        DriftSqlType.double,
        data['${effectivePrefix}longitude'],
      ),
      accuracy: attachedDatabase.typeMapping.read(
        DriftSqlType.double,
        data['${effectivePrefix}accuracy'],
      ),
      locationCapturedAt: attachedDatabase.typeMapping.read(
        DriftSqlType.dateTime,
        data['${effectivePrefix}location_captured_at'],
      ),
      haversineDistance: attachedDatabase.typeMapping.read(
        DriftSqlType.double,
        data['${effectivePrefix}haversine_distance'],
      ),
      isMocked: attachedDatabase.typeMapping.read(
        DriftSqlType.bool,
        data['${effectivePrefix}is_mocked'],
      )!,
      inputChannel: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}input_channel'],
      ),
      scannedAtUtc: attachedDatabase.typeMapping.read(
        DriftSqlType.dateTime,
        data['${effectivePrefix}scanned_at_utc'],
      )!,
      syncStatus: $OfflineAttendanceQueueTable.$convertersyncStatus.fromSql(
        attachedDatabase.typeMapping.read(
          DriftSqlType.string,
          data['${effectivePrefix}sync_status'],
        )!,
      ),
      serverError: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}server_error'],
      ),
      retryCount: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}retry_count'],
      )!,
      lastSentAt: attachedDatabase.typeMapping.read(
        DriftSqlType.dateTime,
        data['${effectivePrefix}last_sent_at'],
      ),
      createdAt: attachedDatabase.typeMapping.read(
        DriftSqlType.dateTime,
        data['${effectivePrefix}created_at'],
      )!,
    );
  }

  @override
  $OfflineAttendanceQueueTable createAlias(String alias) {
    return $OfflineAttendanceQueueTable(attachedDatabase, alias);
  }

  static TypeConverter<AttendanceSyncStatus, String> $convertersyncStatus =
      const AttendanceSyncStatusConverter();
}

class OfflineAttendanceQueueRow extends DataClass
    implements Insertable<OfflineAttendanceQueueRow> {
  final String clientReceiptId;
  final String userId;
  final String sessionId;
  final String studentId;
  final String scannedToken;
  final String? checkpoint;
  final String? pinHash;

  /// Meeting PIN persisted *encrypted at rest* (AES-256-GCM envelope,
  /// `AttendancePinCipher`) so a PIN-protected offline scan survives a cold
  /// start — RN parity: the plaintext PIN lives inside the encrypted
  /// `sync_queue_v2` payload on Android. Never contains plaintext; a failed
  /// decrypt drains without the PIN (server then stamps terminal
  /// `pin_required`, evidence retained).
  final String? pinEncrypted;
  final double? latitude;
  final double? longitude;
  final double? accuracy;

  /// Trusted-clock timestamp of the GNSS fix that produced [latitude] /
  /// [longitude] (in-person scans only — online sessions stay location-free,
  /// RA 10173). The backend's `missingCoreEvidence` gate stamps
  /// `disputed / missing_scan_evidence` on an in-person replay without it.
  final DateTime? locationCapturedAt;
  final double? haversineDistance;
  final bool isMocked;

  /// How the QR was captured (`camera` / `image` / `manual`) at scan time.
  /// Replayed verbatim, because the backend's `missingCoreEvidence` gate
  /// stamps `disputed / missing_scan_evidence` on any scan without it. Null
  /// only for rows queued before schema v3 — the channel was never captured
  /// then, and a replay of such a row truthfully reports the missing
  /// evidence instead of inventing a channel.
  final String? inputChannel;
  final DateTime scannedAtUtc;
  final AttendanceSyncStatus syncStatus;
  final String? serverError;
  final int retryCount;
  final DateTime? lastSentAt;
  final DateTime createdAt;
  const OfflineAttendanceQueueRow({
    required this.clientReceiptId,
    required this.userId,
    required this.sessionId,
    required this.studentId,
    required this.scannedToken,
    this.checkpoint,
    this.pinHash,
    this.pinEncrypted,
    this.latitude,
    this.longitude,
    this.accuracy,
    this.locationCapturedAt,
    this.haversineDistance,
    required this.isMocked,
    this.inputChannel,
    required this.scannedAtUtc,
    required this.syncStatus,
    this.serverError,
    required this.retryCount,
    this.lastSentAt,
    required this.createdAt,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['client_receipt_id'] = Variable<String>(clientReceiptId);
    map['user_id'] = Variable<String>(userId);
    map['session_id'] = Variable<String>(sessionId);
    map['student_id'] = Variable<String>(studentId);
    map['scanned_token'] = Variable<String>(scannedToken);
    if (!nullToAbsent || checkpoint != null) {
      map['checkpoint'] = Variable<String>(checkpoint);
    }
    if (!nullToAbsent || pinHash != null) {
      map['pin_hash'] = Variable<String>(pinHash);
    }
    if (!nullToAbsent || pinEncrypted != null) {
      map['pin_encrypted'] = Variable<String>(pinEncrypted);
    }
    if (!nullToAbsent || latitude != null) {
      map['latitude'] = Variable<double>(latitude);
    }
    if (!nullToAbsent || longitude != null) {
      map['longitude'] = Variable<double>(longitude);
    }
    if (!nullToAbsent || accuracy != null) {
      map['accuracy'] = Variable<double>(accuracy);
    }
    if (!nullToAbsent || locationCapturedAt != null) {
      map['location_captured_at'] = Variable<DateTime>(locationCapturedAt);
    }
    if (!nullToAbsent || haversineDistance != null) {
      map['haversine_distance'] = Variable<double>(haversineDistance);
    }
    map['is_mocked'] = Variable<bool>(isMocked);
    if (!nullToAbsent || inputChannel != null) {
      map['input_channel'] = Variable<String>(inputChannel);
    }
    map['scanned_at_utc'] = Variable<DateTime>(scannedAtUtc);
    {
      map['sync_status'] = Variable<String>(
        $OfflineAttendanceQueueTable.$convertersyncStatus.toSql(syncStatus),
      );
    }
    if (!nullToAbsent || serverError != null) {
      map['server_error'] = Variable<String>(serverError);
    }
    map['retry_count'] = Variable<int>(retryCount);
    if (!nullToAbsent || lastSentAt != null) {
      map['last_sent_at'] = Variable<DateTime>(lastSentAt);
    }
    map['created_at'] = Variable<DateTime>(createdAt);
    return map;
  }

  OfflineAttendanceQueueCompanion toCompanion(bool nullToAbsent) {
    return OfflineAttendanceQueueCompanion(
      clientReceiptId: Value(clientReceiptId),
      userId: Value(userId),
      sessionId: Value(sessionId),
      studentId: Value(studentId),
      scannedToken: Value(scannedToken),
      checkpoint: checkpoint == null && nullToAbsent
          ? const Value.absent()
          : Value(checkpoint),
      pinHash: pinHash == null && nullToAbsent
          ? const Value.absent()
          : Value(pinHash),
      pinEncrypted: pinEncrypted == null && nullToAbsent
          ? const Value.absent()
          : Value(pinEncrypted),
      latitude: latitude == null && nullToAbsent
          ? const Value.absent()
          : Value(latitude),
      longitude: longitude == null && nullToAbsent
          ? const Value.absent()
          : Value(longitude),
      accuracy: accuracy == null && nullToAbsent
          ? const Value.absent()
          : Value(accuracy),
      locationCapturedAt: locationCapturedAt == null && nullToAbsent
          ? const Value.absent()
          : Value(locationCapturedAt),
      haversineDistance: haversineDistance == null && nullToAbsent
          ? const Value.absent()
          : Value(haversineDistance),
      isMocked: Value(isMocked),
      inputChannel: inputChannel == null && nullToAbsent
          ? const Value.absent()
          : Value(inputChannel),
      scannedAtUtc: Value(scannedAtUtc),
      syncStatus: Value(syncStatus),
      serverError: serverError == null && nullToAbsent
          ? const Value.absent()
          : Value(serverError),
      retryCount: Value(retryCount),
      lastSentAt: lastSentAt == null && nullToAbsent
          ? const Value.absent()
          : Value(lastSentAt),
      createdAt: Value(createdAt),
    );
  }

  factory OfflineAttendanceQueueRow.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return OfflineAttendanceQueueRow(
      clientReceiptId: serializer.fromJson<String>(json['clientReceiptId']),
      userId: serializer.fromJson<String>(json['userId']),
      sessionId: serializer.fromJson<String>(json['sessionId']),
      studentId: serializer.fromJson<String>(json['studentId']),
      scannedToken: serializer.fromJson<String>(json['scannedToken']),
      checkpoint: serializer.fromJson<String?>(json['checkpoint']),
      pinHash: serializer.fromJson<String?>(json['pinHash']),
      pinEncrypted: serializer.fromJson<String?>(json['pinEncrypted']),
      latitude: serializer.fromJson<double?>(json['latitude']),
      longitude: serializer.fromJson<double?>(json['longitude']),
      accuracy: serializer.fromJson<double?>(json['accuracy']),
      locationCapturedAt: serializer.fromJson<DateTime?>(
        json['locationCapturedAt'],
      ),
      haversineDistance: serializer.fromJson<double?>(
        json['haversineDistance'],
      ),
      isMocked: serializer.fromJson<bool>(json['isMocked']),
      inputChannel: serializer.fromJson<String?>(json['inputChannel']),
      scannedAtUtc: serializer.fromJson<DateTime>(json['scannedAtUtc']),
      syncStatus: serializer.fromJson<AttendanceSyncStatus>(json['syncStatus']),
      serverError: serializer.fromJson<String?>(json['serverError']),
      retryCount: serializer.fromJson<int>(json['retryCount']),
      lastSentAt: serializer.fromJson<DateTime?>(json['lastSentAt']),
      createdAt: serializer.fromJson<DateTime>(json['createdAt']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'clientReceiptId': serializer.toJson<String>(clientReceiptId),
      'userId': serializer.toJson<String>(userId),
      'sessionId': serializer.toJson<String>(sessionId),
      'studentId': serializer.toJson<String>(studentId),
      'scannedToken': serializer.toJson<String>(scannedToken),
      'checkpoint': serializer.toJson<String?>(checkpoint),
      'pinHash': serializer.toJson<String?>(pinHash),
      'pinEncrypted': serializer.toJson<String?>(pinEncrypted),
      'latitude': serializer.toJson<double?>(latitude),
      'longitude': serializer.toJson<double?>(longitude),
      'accuracy': serializer.toJson<double?>(accuracy),
      'locationCapturedAt': serializer.toJson<DateTime?>(locationCapturedAt),
      'haversineDistance': serializer.toJson<double?>(haversineDistance),
      'isMocked': serializer.toJson<bool>(isMocked),
      'inputChannel': serializer.toJson<String?>(inputChannel),
      'scannedAtUtc': serializer.toJson<DateTime>(scannedAtUtc),
      'syncStatus': serializer.toJson<AttendanceSyncStatus>(syncStatus),
      'serverError': serializer.toJson<String?>(serverError),
      'retryCount': serializer.toJson<int>(retryCount),
      'lastSentAt': serializer.toJson<DateTime?>(lastSentAt),
      'createdAt': serializer.toJson<DateTime>(createdAt),
    };
  }

  OfflineAttendanceQueueRow copyWith({
    String? clientReceiptId,
    String? userId,
    String? sessionId,
    String? studentId,
    String? scannedToken,
    Value<String?> checkpoint = const Value.absent(),
    Value<String?> pinHash = const Value.absent(),
    Value<String?> pinEncrypted = const Value.absent(),
    Value<double?> latitude = const Value.absent(),
    Value<double?> longitude = const Value.absent(),
    Value<double?> accuracy = const Value.absent(),
    Value<DateTime?> locationCapturedAt = const Value.absent(),
    Value<double?> haversineDistance = const Value.absent(),
    bool? isMocked,
    Value<String?> inputChannel = const Value.absent(),
    DateTime? scannedAtUtc,
    AttendanceSyncStatus? syncStatus,
    Value<String?> serverError = const Value.absent(),
    int? retryCount,
    Value<DateTime?> lastSentAt = const Value.absent(),
    DateTime? createdAt,
  }) => OfflineAttendanceQueueRow(
    clientReceiptId: clientReceiptId ?? this.clientReceiptId,
    userId: userId ?? this.userId,
    sessionId: sessionId ?? this.sessionId,
    studentId: studentId ?? this.studentId,
    scannedToken: scannedToken ?? this.scannedToken,
    checkpoint: checkpoint.present ? checkpoint.value : this.checkpoint,
    pinHash: pinHash.present ? pinHash.value : this.pinHash,
    pinEncrypted: pinEncrypted.present ? pinEncrypted.value : this.pinEncrypted,
    latitude: latitude.present ? latitude.value : this.latitude,
    longitude: longitude.present ? longitude.value : this.longitude,
    accuracy: accuracy.present ? accuracy.value : this.accuracy,
    locationCapturedAt: locationCapturedAt.present
        ? locationCapturedAt.value
        : this.locationCapturedAt,
    haversineDistance: haversineDistance.present
        ? haversineDistance.value
        : this.haversineDistance,
    isMocked: isMocked ?? this.isMocked,
    inputChannel: inputChannel.present ? inputChannel.value : this.inputChannel,
    scannedAtUtc: scannedAtUtc ?? this.scannedAtUtc,
    syncStatus: syncStatus ?? this.syncStatus,
    serverError: serverError.present ? serverError.value : this.serverError,
    retryCount: retryCount ?? this.retryCount,
    lastSentAt: lastSentAt.present ? lastSentAt.value : this.lastSentAt,
    createdAt: createdAt ?? this.createdAt,
  );
  OfflineAttendanceQueueRow copyWithCompanion(
    OfflineAttendanceQueueCompanion data,
  ) {
    return OfflineAttendanceQueueRow(
      clientReceiptId: data.clientReceiptId.present
          ? data.clientReceiptId.value
          : this.clientReceiptId,
      userId: data.userId.present ? data.userId.value : this.userId,
      sessionId: data.sessionId.present ? data.sessionId.value : this.sessionId,
      studentId: data.studentId.present ? data.studentId.value : this.studentId,
      scannedToken: data.scannedToken.present
          ? data.scannedToken.value
          : this.scannedToken,
      checkpoint: data.checkpoint.present
          ? data.checkpoint.value
          : this.checkpoint,
      pinHash: data.pinHash.present ? data.pinHash.value : this.pinHash,
      pinEncrypted: data.pinEncrypted.present
          ? data.pinEncrypted.value
          : this.pinEncrypted,
      latitude: data.latitude.present ? data.latitude.value : this.latitude,
      longitude: data.longitude.present ? data.longitude.value : this.longitude,
      accuracy: data.accuracy.present ? data.accuracy.value : this.accuracy,
      locationCapturedAt: data.locationCapturedAt.present
          ? data.locationCapturedAt.value
          : this.locationCapturedAt,
      haversineDistance: data.haversineDistance.present
          ? data.haversineDistance.value
          : this.haversineDistance,
      isMocked: data.isMocked.present ? data.isMocked.value : this.isMocked,
      inputChannel: data.inputChannel.present
          ? data.inputChannel.value
          : this.inputChannel,
      scannedAtUtc: data.scannedAtUtc.present
          ? data.scannedAtUtc.value
          : this.scannedAtUtc,
      syncStatus: data.syncStatus.present
          ? data.syncStatus.value
          : this.syncStatus,
      serverError: data.serverError.present
          ? data.serverError.value
          : this.serverError,
      retryCount: data.retryCount.present
          ? data.retryCount.value
          : this.retryCount,
      lastSentAt: data.lastSentAt.present
          ? data.lastSentAt.value
          : this.lastSentAt,
      createdAt: data.createdAt.present ? data.createdAt.value : this.createdAt,
    );
  }

  @override
  String toString() {
    return (StringBuffer('OfflineAttendanceQueueRow(')
          ..write('clientReceiptId: $clientReceiptId, ')
          ..write('userId: $userId, ')
          ..write('sessionId: $sessionId, ')
          ..write('studentId: $studentId, ')
          ..write('scannedToken: $scannedToken, ')
          ..write('checkpoint: $checkpoint, ')
          ..write('pinHash: $pinHash, ')
          ..write('pinEncrypted: $pinEncrypted, ')
          ..write('latitude: $latitude, ')
          ..write('longitude: $longitude, ')
          ..write('accuracy: $accuracy, ')
          ..write('locationCapturedAt: $locationCapturedAt, ')
          ..write('haversineDistance: $haversineDistance, ')
          ..write('isMocked: $isMocked, ')
          ..write('inputChannel: $inputChannel, ')
          ..write('scannedAtUtc: $scannedAtUtc, ')
          ..write('syncStatus: $syncStatus, ')
          ..write('serverError: $serverError, ')
          ..write('retryCount: $retryCount, ')
          ..write('lastSentAt: $lastSentAt, ')
          ..write('createdAt: $createdAt')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hashAll([
    clientReceiptId,
    userId,
    sessionId,
    studentId,
    scannedToken,
    checkpoint,
    pinHash,
    pinEncrypted,
    latitude,
    longitude,
    accuracy,
    locationCapturedAt,
    haversineDistance,
    isMocked,
    inputChannel,
    scannedAtUtc,
    syncStatus,
    serverError,
    retryCount,
    lastSentAt,
    createdAt,
  ]);
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is OfflineAttendanceQueueRow &&
          other.clientReceiptId == this.clientReceiptId &&
          other.userId == this.userId &&
          other.sessionId == this.sessionId &&
          other.studentId == this.studentId &&
          other.scannedToken == this.scannedToken &&
          other.checkpoint == this.checkpoint &&
          other.pinHash == this.pinHash &&
          other.pinEncrypted == this.pinEncrypted &&
          other.latitude == this.latitude &&
          other.longitude == this.longitude &&
          other.accuracy == this.accuracy &&
          other.locationCapturedAt == this.locationCapturedAt &&
          other.haversineDistance == this.haversineDistance &&
          other.isMocked == this.isMocked &&
          other.inputChannel == this.inputChannel &&
          other.scannedAtUtc == this.scannedAtUtc &&
          other.syncStatus == this.syncStatus &&
          other.serverError == this.serverError &&
          other.retryCount == this.retryCount &&
          other.lastSentAt == this.lastSentAt &&
          other.createdAt == this.createdAt);
}

class OfflineAttendanceQueueCompanion
    extends UpdateCompanion<OfflineAttendanceQueueRow> {
  final Value<String> clientReceiptId;
  final Value<String> userId;
  final Value<String> sessionId;
  final Value<String> studentId;
  final Value<String> scannedToken;
  final Value<String?> checkpoint;
  final Value<String?> pinHash;
  final Value<String?> pinEncrypted;
  final Value<double?> latitude;
  final Value<double?> longitude;
  final Value<double?> accuracy;
  final Value<DateTime?> locationCapturedAt;
  final Value<double?> haversineDistance;
  final Value<bool> isMocked;
  final Value<String?> inputChannel;
  final Value<DateTime> scannedAtUtc;
  final Value<AttendanceSyncStatus> syncStatus;
  final Value<String?> serverError;
  final Value<int> retryCount;
  final Value<DateTime?> lastSentAt;
  final Value<DateTime> createdAt;
  final Value<int> rowid;
  const OfflineAttendanceQueueCompanion({
    this.clientReceiptId = const Value.absent(),
    this.userId = const Value.absent(),
    this.sessionId = const Value.absent(),
    this.studentId = const Value.absent(),
    this.scannedToken = const Value.absent(),
    this.checkpoint = const Value.absent(),
    this.pinHash = const Value.absent(),
    this.pinEncrypted = const Value.absent(),
    this.latitude = const Value.absent(),
    this.longitude = const Value.absent(),
    this.accuracy = const Value.absent(),
    this.locationCapturedAt = const Value.absent(),
    this.haversineDistance = const Value.absent(),
    this.isMocked = const Value.absent(),
    this.inputChannel = const Value.absent(),
    this.scannedAtUtc = const Value.absent(),
    this.syncStatus = const Value.absent(),
    this.serverError = const Value.absent(),
    this.retryCount = const Value.absent(),
    this.lastSentAt = const Value.absent(),
    this.createdAt = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  OfflineAttendanceQueueCompanion.insert({
    required String clientReceiptId,
    required String userId,
    required String sessionId,
    required String studentId,
    required String scannedToken,
    this.checkpoint = const Value.absent(),
    this.pinHash = const Value.absent(),
    this.pinEncrypted = const Value.absent(),
    this.latitude = const Value.absent(),
    this.longitude = const Value.absent(),
    this.accuracy = const Value.absent(),
    this.locationCapturedAt = const Value.absent(),
    this.haversineDistance = const Value.absent(),
    this.isMocked = const Value.absent(),
    this.inputChannel = const Value.absent(),
    required DateTime scannedAtUtc,
    required AttendanceSyncStatus syncStatus,
    this.serverError = const Value.absent(),
    this.retryCount = const Value.absent(),
    this.lastSentAt = const Value.absent(),
    required DateTime createdAt,
    this.rowid = const Value.absent(),
  }) : clientReceiptId = Value(clientReceiptId),
       userId = Value(userId),
       sessionId = Value(sessionId),
       studentId = Value(studentId),
       scannedToken = Value(scannedToken),
       scannedAtUtc = Value(scannedAtUtc),
       syncStatus = Value(syncStatus),
       createdAt = Value(createdAt);
  static Insertable<OfflineAttendanceQueueRow> custom({
    Expression<String>? clientReceiptId,
    Expression<String>? userId,
    Expression<String>? sessionId,
    Expression<String>? studentId,
    Expression<String>? scannedToken,
    Expression<String>? checkpoint,
    Expression<String>? pinHash,
    Expression<String>? pinEncrypted,
    Expression<double>? latitude,
    Expression<double>? longitude,
    Expression<double>? accuracy,
    Expression<DateTime>? locationCapturedAt,
    Expression<double>? haversineDistance,
    Expression<bool>? isMocked,
    Expression<String>? inputChannel,
    Expression<DateTime>? scannedAtUtc,
    Expression<String>? syncStatus,
    Expression<String>? serverError,
    Expression<int>? retryCount,
    Expression<DateTime>? lastSentAt,
    Expression<DateTime>? createdAt,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (clientReceiptId != null) 'client_receipt_id': clientReceiptId,
      if (userId != null) 'user_id': userId,
      if (sessionId != null) 'session_id': sessionId,
      if (studentId != null) 'student_id': studentId,
      if (scannedToken != null) 'scanned_token': scannedToken,
      if (checkpoint != null) 'checkpoint': checkpoint,
      if (pinHash != null) 'pin_hash': pinHash,
      if (pinEncrypted != null) 'pin_encrypted': pinEncrypted,
      if (latitude != null) 'latitude': latitude,
      if (longitude != null) 'longitude': longitude,
      if (accuracy != null) 'accuracy': accuracy,
      if (locationCapturedAt != null)
        'location_captured_at': locationCapturedAt,
      if (haversineDistance != null) 'haversine_distance': haversineDistance,
      if (isMocked != null) 'is_mocked': isMocked,
      if (inputChannel != null) 'input_channel': inputChannel,
      if (scannedAtUtc != null) 'scanned_at_utc': scannedAtUtc,
      if (syncStatus != null) 'sync_status': syncStatus,
      if (serverError != null) 'server_error': serverError,
      if (retryCount != null) 'retry_count': retryCount,
      if (lastSentAt != null) 'last_sent_at': lastSentAt,
      if (createdAt != null) 'created_at': createdAt,
      if (rowid != null) 'rowid': rowid,
    });
  }

  OfflineAttendanceQueueCompanion copyWith({
    Value<String>? clientReceiptId,
    Value<String>? userId,
    Value<String>? sessionId,
    Value<String>? studentId,
    Value<String>? scannedToken,
    Value<String?>? checkpoint,
    Value<String?>? pinHash,
    Value<String?>? pinEncrypted,
    Value<double?>? latitude,
    Value<double?>? longitude,
    Value<double?>? accuracy,
    Value<DateTime?>? locationCapturedAt,
    Value<double?>? haversineDistance,
    Value<bool>? isMocked,
    Value<String?>? inputChannel,
    Value<DateTime>? scannedAtUtc,
    Value<AttendanceSyncStatus>? syncStatus,
    Value<String?>? serverError,
    Value<int>? retryCount,
    Value<DateTime?>? lastSentAt,
    Value<DateTime>? createdAt,
    Value<int>? rowid,
  }) {
    return OfflineAttendanceQueueCompanion(
      clientReceiptId: clientReceiptId ?? this.clientReceiptId,
      userId: userId ?? this.userId,
      sessionId: sessionId ?? this.sessionId,
      studentId: studentId ?? this.studentId,
      scannedToken: scannedToken ?? this.scannedToken,
      checkpoint: checkpoint ?? this.checkpoint,
      pinHash: pinHash ?? this.pinHash,
      pinEncrypted: pinEncrypted ?? this.pinEncrypted,
      latitude: latitude ?? this.latitude,
      longitude: longitude ?? this.longitude,
      accuracy: accuracy ?? this.accuracy,
      locationCapturedAt: locationCapturedAt ?? this.locationCapturedAt,
      haversineDistance: haversineDistance ?? this.haversineDistance,
      isMocked: isMocked ?? this.isMocked,
      inputChannel: inputChannel ?? this.inputChannel,
      scannedAtUtc: scannedAtUtc ?? this.scannedAtUtc,
      syncStatus: syncStatus ?? this.syncStatus,
      serverError: serverError ?? this.serverError,
      retryCount: retryCount ?? this.retryCount,
      lastSentAt: lastSentAt ?? this.lastSentAt,
      createdAt: createdAt ?? this.createdAt,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (clientReceiptId.present) {
      map['client_receipt_id'] = Variable<String>(clientReceiptId.value);
    }
    if (userId.present) {
      map['user_id'] = Variable<String>(userId.value);
    }
    if (sessionId.present) {
      map['session_id'] = Variable<String>(sessionId.value);
    }
    if (studentId.present) {
      map['student_id'] = Variable<String>(studentId.value);
    }
    if (scannedToken.present) {
      map['scanned_token'] = Variable<String>(scannedToken.value);
    }
    if (checkpoint.present) {
      map['checkpoint'] = Variable<String>(checkpoint.value);
    }
    if (pinHash.present) {
      map['pin_hash'] = Variable<String>(pinHash.value);
    }
    if (pinEncrypted.present) {
      map['pin_encrypted'] = Variable<String>(pinEncrypted.value);
    }
    if (latitude.present) {
      map['latitude'] = Variable<double>(latitude.value);
    }
    if (longitude.present) {
      map['longitude'] = Variable<double>(longitude.value);
    }
    if (accuracy.present) {
      map['accuracy'] = Variable<double>(accuracy.value);
    }
    if (locationCapturedAt.present) {
      map['location_captured_at'] = Variable<DateTime>(
        locationCapturedAt.value,
      );
    }
    if (haversineDistance.present) {
      map['haversine_distance'] = Variable<double>(haversineDistance.value);
    }
    if (isMocked.present) {
      map['is_mocked'] = Variable<bool>(isMocked.value);
    }
    if (inputChannel.present) {
      map['input_channel'] = Variable<String>(inputChannel.value);
    }
    if (scannedAtUtc.present) {
      map['scanned_at_utc'] = Variable<DateTime>(scannedAtUtc.value);
    }
    if (syncStatus.present) {
      map['sync_status'] = Variable<String>(
        $OfflineAttendanceQueueTable.$convertersyncStatus.toSql(
          syncStatus.value,
        ),
      );
    }
    if (serverError.present) {
      map['server_error'] = Variable<String>(serverError.value);
    }
    if (retryCount.present) {
      map['retry_count'] = Variable<int>(retryCount.value);
    }
    if (lastSentAt.present) {
      map['last_sent_at'] = Variable<DateTime>(lastSentAt.value);
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
    return (StringBuffer('OfflineAttendanceQueueCompanion(')
          ..write('clientReceiptId: $clientReceiptId, ')
          ..write('userId: $userId, ')
          ..write('sessionId: $sessionId, ')
          ..write('studentId: $studentId, ')
          ..write('scannedToken: $scannedToken, ')
          ..write('checkpoint: $checkpoint, ')
          ..write('pinHash: $pinHash, ')
          ..write('pinEncrypted: $pinEncrypted, ')
          ..write('latitude: $latitude, ')
          ..write('longitude: $longitude, ')
          ..write('accuracy: $accuracy, ')
          ..write('locationCapturedAt: $locationCapturedAt, ')
          ..write('haversineDistance: $haversineDistance, ')
          ..write('isMocked: $isMocked, ')
          ..write('inputChannel: $inputChannel, ')
          ..write('scannedAtUtc: $scannedAtUtc, ')
          ..write('syncStatus: $syncStatus, ')
          ..write('serverError: $serverError, ')
          ..write('retryCount: $retryCount, ')
          ..write('lastSentAt: $lastSentAt, ')
          ..write('createdAt: $createdAt, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $SystemReportQueueTable extends SystemReportQueue
    with TableInfo<$SystemReportQueueTable, SystemReportQueueRow> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $SystemReportQueueTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _clientReceiptIdMeta = const VerificationMeta(
    'clientReceiptId',
  );
  @override
  late final GeneratedColumn<String> clientReceiptId = GeneratedColumn<String>(
    'client_receipt_id',
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
  static const VerificationMeta _categoryMeta = const VerificationMeta(
    'category',
  );
  @override
  late final GeneratedColumn<String> category = GeneratedColumn<String>(
    'category',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _severityMeta = const VerificationMeta(
    'severity',
  );
  @override
  late final GeneratedColumn<String> severity = GeneratedColumn<String>(
    'severity',
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
  static const VerificationMeta _descriptionMeta = const VerificationMeta(
    'description',
  );
  @override
  late final GeneratedColumn<String> description = GeneratedColumn<String>(
    'description',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _screenshotDataMeta = const VerificationMeta(
    'screenshotData',
  );
  @override
  late final GeneratedColumn<String> screenshotData = GeneratedColumn<String>(
    'screenshot_data',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _deviceInfoMeta = const VerificationMeta(
    'deviceInfo',
  );
  @override
  late final GeneratedColumn<String> deviceInfo = GeneratedColumn<String>(
    'device_info',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _appVersionMeta = const VerificationMeta(
    'appVersion',
  );
  @override
  late final GeneratedColumn<String> appVersion = GeneratedColumn<String>(
    'app_version',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _routeMeta = const VerificationMeta('route');
  @override
  late final GeneratedColumn<String> route = GeneratedColumn<String>(
    'route',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _networkTypeMeta = const VerificationMeta(
    'networkType',
  );
  @override
  late final GeneratedColumn<String> networkType = GeneratedColumn<String>(
    'network_type',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  @override
  late final GeneratedColumnWithTypeConverter<OutboxStatus, String> syncStatus =
      GeneratedColumn<String>(
        'sync_status',
        aliasedName,
        false,
        type: DriftSqlType.string,
        requiredDuringInsert: true,
      ).withConverter<OutboxStatus>(
        $SystemReportQueueTable.$convertersyncStatus,
      );
  static const VerificationMeta _serverErrorMeta = const VerificationMeta(
    'serverError',
  );
  @override
  late final GeneratedColumn<String> serverError = GeneratedColumn<String>(
    'server_error',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _retryCountMeta = const VerificationMeta(
    'retryCount',
  );
  @override
  late final GeneratedColumn<int> retryCount = GeneratedColumn<int>(
    'retry_count',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
    defaultValue: const Constant(0),
  );
  static const VerificationMeta _lastSentAtMeta = const VerificationMeta(
    'lastSentAt',
  );
  @override
  late final GeneratedColumn<DateTime> lastSentAt = GeneratedColumn<DateTime>(
    'last_sent_at',
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
    requiredDuringInsert: true,
  );
  @override
  List<GeneratedColumn> get $columns => [
    clientReceiptId,
    userId,
    category,
    severity,
    title,
    description,
    screenshotData,
    deviceInfo,
    appVersion,
    route,
    networkType,
    syncStatus,
    serverError,
    retryCount,
    lastSentAt,
    createdAt,
  ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'system_report_queue';
  @override
  VerificationContext validateIntegrity(
    Insertable<SystemReportQueueRow> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('client_receipt_id')) {
      context.handle(
        _clientReceiptIdMeta,
        clientReceiptId.isAcceptableOrUnknown(
          data['client_receipt_id']!,
          _clientReceiptIdMeta,
        ),
      );
    } else if (isInserting) {
      context.missing(_clientReceiptIdMeta);
    }
    if (data.containsKey('user_id')) {
      context.handle(
        _userIdMeta,
        userId.isAcceptableOrUnknown(data['user_id']!, _userIdMeta),
      );
    } else if (isInserting) {
      context.missing(_userIdMeta);
    }
    if (data.containsKey('category')) {
      context.handle(
        _categoryMeta,
        category.isAcceptableOrUnknown(data['category']!, _categoryMeta),
      );
    } else if (isInserting) {
      context.missing(_categoryMeta);
    }
    if (data.containsKey('severity')) {
      context.handle(
        _severityMeta,
        severity.isAcceptableOrUnknown(data['severity']!, _severityMeta),
      );
    } else if (isInserting) {
      context.missing(_severityMeta);
    }
    if (data.containsKey('title')) {
      context.handle(
        _titleMeta,
        title.isAcceptableOrUnknown(data['title']!, _titleMeta),
      );
    } else if (isInserting) {
      context.missing(_titleMeta);
    }
    if (data.containsKey('description')) {
      context.handle(
        _descriptionMeta,
        description.isAcceptableOrUnknown(
          data['description']!,
          _descriptionMeta,
        ),
      );
    } else if (isInserting) {
      context.missing(_descriptionMeta);
    }
    if (data.containsKey('screenshot_data')) {
      context.handle(
        _screenshotDataMeta,
        screenshotData.isAcceptableOrUnknown(
          data['screenshot_data']!,
          _screenshotDataMeta,
        ),
      );
    }
    if (data.containsKey('device_info')) {
      context.handle(
        _deviceInfoMeta,
        deviceInfo.isAcceptableOrUnknown(data['device_info']!, _deviceInfoMeta),
      );
    }
    if (data.containsKey('app_version')) {
      context.handle(
        _appVersionMeta,
        appVersion.isAcceptableOrUnknown(data['app_version']!, _appVersionMeta),
      );
    }
    if (data.containsKey('route')) {
      context.handle(
        _routeMeta,
        route.isAcceptableOrUnknown(data['route']!, _routeMeta),
      );
    }
    if (data.containsKey('network_type')) {
      context.handle(
        _networkTypeMeta,
        networkType.isAcceptableOrUnknown(
          data['network_type']!,
          _networkTypeMeta,
        ),
      );
    }
    if (data.containsKey('server_error')) {
      context.handle(
        _serverErrorMeta,
        serverError.isAcceptableOrUnknown(
          data['server_error']!,
          _serverErrorMeta,
        ),
      );
    }
    if (data.containsKey('retry_count')) {
      context.handle(
        _retryCountMeta,
        retryCount.isAcceptableOrUnknown(data['retry_count']!, _retryCountMeta),
      );
    }
    if (data.containsKey('last_sent_at')) {
      context.handle(
        _lastSentAtMeta,
        lastSentAt.isAcceptableOrUnknown(
          data['last_sent_at']!,
          _lastSentAtMeta,
        ),
      );
    }
    if (data.containsKey('created_at')) {
      context.handle(
        _createdAtMeta,
        createdAt.isAcceptableOrUnknown(data['created_at']!, _createdAtMeta),
      );
    } else if (isInserting) {
      context.missing(_createdAtMeta);
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {clientReceiptId};
  @override
  SystemReportQueueRow map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return SystemReportQueueRow(
      clientReceiptId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}client_receipt_id'],
      )!,
      userId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}user_id'],
      )!,
      category: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}category'],
      )!,
      severity: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}severity'],
      )!,
      title: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}title'],
      )!,
      description: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}description'],
      )!,
      screenshotData: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}screenshot_data'],
      ),
      deviceInfo: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}device_info'],
      ),
      appVersion: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}app_version'],
      ),
      route: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}route'],
      ),
      networkType: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}network_type'],
      ),
      syncStatus: $SystemReportQueueTable.$convertersyncStatus.fromSql(
        attachedDatabase.typeMapping.read(
          DriftSqlType.string,
          data['${effectivePrefix}sync_status'],
        )!,
      ),
      serverError: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}server_error'],
      ),
      retryCount: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}retry_count'],
      )!,
      lastSentAt: attachedDatabase.typeMapping.read(
        DriftSqlType.dateTime,
        data['${effectivePrefix}last_sent_at'],
      ),
      createdAt: attachedDatabase.typeMapping.read(
        DriftSqlType.dateTime,
        data['${effectivePrefix}created_at'],
      )!,
    );
  }

  @override
  $SystemReportQueueTable createAlias(String alias) {
    return $SystemReportQueueTable(attachedDatabase, alias);
  }

  static TypeConverter<OutboxStatus, String> $convertersyncStatus =
      const OutboxStatusConverter();
}

class SystemReportQueueRow extends DataClass
    implements Insertable<SystemReportQueueRow> {
  final String clientReceiptId;
  final String userId;
  final String category;
  final String severity;
  final String title;
  final String description;
  final String? screenshotData;
  final String? deviceInfo;
  final String? appVersion;
  final String? route;
  final String? networkType;
  final OutboxStatus syncStatus;
  final String? serverError;
  final int retryCount;
  final DateTime? lastSentAt;
  final DateTime createdAt;
  const SystemReportQueueRow({
    required this.clientReceiptId,
    required this.userId,
    required this.category,
    required this.severity,
    required this.title,
    required this.description,
    this.screenshotData,
    this.deviceInfo,
    this.appVersion,
    this.route,
    this.networkType,
    required this.syncStatus,
    this.serverError,
    required this.retryCount,
    this.lastSentAt,
    required this.createdAt,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['client_receipt_id'] = Variable<String>(clientReceiptId);
    map['user_id'] = Variable<String>(userId);
    map['category'] = Variable<String>(category);
    map['severity'] = Variable<String>(severity);
    map['title'] = Variable<String>(title);
    map['description'] = Variable<String>(description);
    if (!nullToAbsent || screenshotData != null) {
      map['screenshot_data'] = Variable<String>(screenshotData);
    }
    if (!nullToAbsent || deviceInfo != null) {
      map['device_info'] = Variable<String>(deviceInfo);
    }
    if (!nullToAbsent || appVersion != null) {
      map['app_version'] = Variable<String>(appVersion);
    }
    if (!nullToAbsent || route != null) {
      map['route'] = Variable<String>(route);
    }
    if (!nullToAbsent || networkType != null) {
      map['network_type'] = Variable<String>(networkType);
    }
    {
      map['sync_status'] = Variable<String>(
        $SystemReportQueueTable.$convertersyncStatus.toSql(syncStatus),
      );
    }
    if (!nullToAbsent || serverError != null) {
      map['server_error'] = Variable<String>(serverError);
    }
    map['retry_count'] = Variable<int>(retryCount);
    if (!nullToAbsent || lastSentAt != null) {
      map['last_sent_at'] = Variable<DateTime>(lastSentAt);
    }
    map['created_at'] = Variable<DateTime>(createdAt);
    return map;
  }

  SystemReportQueueCompanion toCompanion(bool nullToAbsent) {
    return SystemReportQueueCompanion(
      clientReceiptId: Value(clientReceiptId),
      userId: Value(userId),
      category: Value(category),
      severity: Value(severity),
      title: Value(title),
      description: Value(description),
      screenshotData: screenshotData == null && nullToAbsent
          ? const Value.absent()
          : Value(screenshotData),
      deviceInfo: deviceInfo == null && nullToAbsent
          ? const Value.absent()
          : Value(deviceInfo),
      appVersion: appVersion == null && nullToAbsent
          ? const Value.absent()
          : Value(appVersion),
      route: route == null && nullToAbsent
          ? const Value.absent()
          : Value(route),
      networkType: networkType == null && nullToAbsent
          ? const Value.absent()
          : Value(networkType),
      syncStatus: Value(syncStatus),
      serverError: serverError == null && nullToAbsent
          ? const Value.absent()
          : Value(serverError),
      retryCount: Value(retryCount),
      lastSentAt: lastSentAt == null && nullToAbsent
          ? const Value.absent()
          : Value(lastSentAt),
      createdAt: Value(createdAt),
    );
  }

  factory SystemReportQueueRow.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return SystemReportQueueRow(
      clientReceiptId: serializer.fromJson<String>(json['clientReceiptId']),
      userId: serializer.fromJson<String>(json['userId']),
      category: serializer.fromJson<String>(json['category']),
      severity: serializer.fromJson<String>(json['severity']),
      title: serializer.fromJson<String>(json['title']),
      description: serializer.fromJson<String>(json['description']),
      screenshotData: serializer.fromJson<String?>(json['screenshotData']),
      deviceInfo: serializer.fromJson<String?>(json['deviceInfo']),
      appVersion: serializer.fromJson<String?>(json['appVersion']),
      route: serializer.fromJson<String?>(json['route']),
      networkType: serializer.fromJson<String?>(json['networkType']),
      syncStatus: serializer.fromJson<OutboxStatus>(json['syncStatus']),
      serverError: serializer.fromJson<String?>(json['serverError']),
      retryCount: serializer.fromJson<int>(json['retryCount']),
      lastSentAt: serializer.fromJson<DateTime?>(json['lastSentAt']),
      createdAt: serializer.fromJson<DateTime>(json['createdAt']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'clientReceiptId': serializer.toJson<String>(clientReceiptId),
      'userId': serializer.toJson<String>(userId),
      'category': serializer.toJson<String>(category),
      'severity': serializer.toJson<String>(severity),
      'title': serializer.toJson<String>(title),
      'description': serializer.toJson<String>(description),
      'screenshotData': serializer.toJson<String?>(screenshotData),
      'deviceInfo': serializer.toJson<String?>(deviceInfo),
      'appVersion': serializer.toJson<String?>(appVersion),
      'route': serializer.toJson<String?>(route),
      'networkType': serializer.toJson<String?>(networkType),
      'syncStatus': serializer.toJson<OutboxStatus>(syncStatus),
      'serverError': serializer.toJson<String?>(serverError),
      'retryCount': serializer.toJson<int>(retryCount),
      'lastSentAt': serializer.toJson<DateTime?>(lastSentAt),
      'createdAt': serializer.toJson<DateTime>(createdAt),
    };
  }

  SystemReportQueueRow copyWith({
    String? clientReceiptId,
    String? userId,
    String? category,
    String? severity,
    String? title,
    String? description,
    Value<String?> screenshotData = const Value.absent(),
    Value<String?> deviceInfo = const Value.absent(),
    Value<String?> appVersion = const Value.absent(),
    Value<String?> route = const Value.absent(),
    Value<String?> networkType = const Value.absent(),
    OutboxStatus? syncStatus,
    Value<String?> serverError = const Value.absent(),
    int? retryCount,
    Value<DateTime?> lastSentAt = const Value.absent(),
    DateTime? createdAt,
  }) => SystemReportQueueRow(
    clientReceiptId: clientReceiptId ?? this.clientReceiptId,
    userId: userId ?? this.userId,
    category: category ?? this.category,
    severity: severity ?? this.severity,
    title: title ?? this.title,
    description: description ?? this.description,
    screenshotData: screenshotData.present
        ? screenshotData.value
        : this.screenshotData,
    deviceInfo: deviceInfo.present ? deviceInfo.value : this.deviceInfo,
    appVersion: appVersion.present ? appVersion.value : this.appVersion,
    route: route.present ? route.value : this.route,
    networkType: networkType.present ? networkType.value : this.networkType,
    syncStatus: syncStatus ?? this.syncStatus,
    serverError: serverError.present ? serverError.value : this.serverError,
    retryCount: retryCount ?? this.retryCount,
    lastSentAt: lastSentAt.present ? lastSentAt.value : this.lastSentAt,
    createdAt: createdAt ?? this.createdAt,
  );
  SystemReportQueueRow copyWithCompanion(SystemReportQueueCompanion data) {
    return SystemReportQueueRow(
      clientReceiptId: data.clientReceiptId.present
          ? data.clientReceiptId.value
          : this.clientReceiptId,
      userId: data.userId.present ? data.userId.value : this.userId,
      category: data.category.present ? data.category.value : this.category,
      severity: data.severity.present ? data.severity.value : this.severity,
      title: data.title.present ? data.title.value : this.title,
      description: data.description.present
          ? data.description.value
          : this.description,
      screenshotData: data.screenshotData.present
          ? data.screenshotData.value
          : this.screenshotData,
      deviceInfo: data.deviceInfo.present
          ? data.deviceInfo.value
          : this.deviceInfo,
      appVersion: data.appVersion.present
          ? data.appVersion.value
          : this.appVersion,
      route: data.route.present ? data.route.value : this.route,
      networkType: data.networkType.present
          ? data.networkType.value
          : this.networkType,
      syncStatus: data.syncStatus.present
          ? data.syncStatus.value
          : this.syncStatus,
      serverError: data.serverError.present
          ? data.serverError.value
          : this.serverError,
      retryCount: data.retryCount.present
          ? data.retryCount.value
          : this.retryCount,
      lastSentAt: data.lastSentAt.present
          ? data.lastSentAt.value
          : this.lastSentAt,
      createdAt: data.createdAt.present ? data.createdAt.value : this.createdAt,
    );
  }

  @override
  String toString() {
    return (StringBuffer('SystemReportQueueRow(')
          ..write('clientReceiptId: $clientReceiptId, ')
          ..write('userId: $userId, ')
          ..write('category: $category, ')
          ..write('severity: $severity, ')
          ..write('title: $title, ')
          ..write('description: $description, ')
          ..write('screenshotData: $screenshotData, ')
          ..write('deviceInfo: $deviceInfo, ')
          ..write('appVersion: $appVersion, ')
          ..write('route: $route, ')
          ..write('networkType: $networkType, ')
          ..write('syncStatus: $syncStatus, ')
          ..write('serverError: $serverError, ')
          ..write('retryCount: $retryCount, ')
          ..write('lastSentAt: $lastSentAt, ')
          ..write('createdAt: $createdAt')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(
    clientReceiptId,
    userId,
    category,
    severity,
    title,
    description,
    screenshotData,
    deviceInfo,
    appVersion,
    route,
    networkType,
    syncStatus,
    serverError,
    retryCount,
    lastSentAt,
    createdAt,
  );
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is SystemReportQueueRow &&
          other.clientReceiptId == this.clientReceiptId &&
          other.userId == this.userId &&
          other.category == this.category &&
          other.severity == this.severity &&
          other.title == this.title &&
          other.description == this.description &&
          other.screenshotData == this.screenshotData &&
          other.deviceInfo == this.deviceInfo &&
          other.appVersion == this.appVersion &&
          other.route == this.route &&
          other.networkType == this.networkType &&
          other.syncStatus == this.syncStatus &&
          other.serverError == this.serverError &&
          other.retryCount == this.retryCount &&
          other.lastSentAt == this.lastSentAt &&
          other.createdAt == this.createdAt);
}

class SystemReportQueueCompanion extends UpdateCompanion<SystemReportQueueRow> {
  final Value<String> clientReceiptId;
  final Value<String> userId;
  final Value<String> category;
  final Value<String> severity;
  final Value<String> title;
  final Value<String> description;
  final Value<String?> screenshotData;
  final Value<String?> deviceInfo;
  final Value<String?> appVersion;
  final Value<String?> route;
  final Value<String?> networkType;
  final Value<OutboxStatus> syncStatus;
  final Value<String?> serverError;
  final Value<int> retryCount;
  final Value<DateTime?> lastSentAt;
  final Value<DateTime> createdAt;
  final Value<int> rowid;
  const SystemReportQueueCompanion({
    this.clientReceiptId = const Value.absent(),
    this.userId = const Value.absent(),
    this.category = const Value.absent(),
    this.severity = const Value.absent(),
    this.title = const Value.absent(),
    this.description = const Value.absent(),
    this.screenshotData = const Value.absent(),
    this.deviceInfo = const Value.absent(),
    this.appVersion = const Value.absent(),
    this.route = const Value.absent(),
    this.networkType = const Value.absent(),
    this.syncStatus = const Value.absent(),
    this.serverError = const Value.absent(),
    this.retryCount = const Value.absent(),
    this.lastSentAt = const Value.absent(),
    this.createdAt = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  SystemReportQueueCompanion.insert({
    required String clientReceiptId,
    required String userId,
    required String category,
    required String severity,
    required String title,
    required String description,
    this.screenshotData = const Value.absent(),
    this.deviceInfo = const Value.absent(),
    this.appVersion = const Value.absent(),
    this.route = const Value.absent(),
    this.networkType = const Value.absent(),
    required OutboxStatus syncStatus,
    this.serverError = const Value.absent(),
    this.retryCount = const Value.absent(),
    this.lastSentAt = const Value.absent(),
    required DateTime createdAt,
    this.rowid = const Value.absent(),
  }) : clientReceiptId = Value(clientReceiptId),
       userId = Value(userId),
       category = Value(category),
       severity = Value(severity),
       title = Value(title),
       description = Value(description),
       syncStatus = Value(syncStatus),
       createdAt = Value(createdAt);
  static Insertable<SystemReportQueueRow> custom({
    Expression<String>? clientReceiptId,
    Expression<String>? userId,
    Expression<String>? category,
    Expression<String>? severity,
    Expression<String>? title,
    Expression<String>? description,
    Expression<String>? screenshotData,
    Expression<String>? deviceInfo,
    Expression<String>? appVersion,
    Expression<String>? route,
    Expression<String>? networkType,
    Expression<String>? syncStatus,
    Expression<String>? serverError,
    Expression<int>? retryCount,
    Expression<DateTime>? lastSentAt,
    Expression<DateTime>? createdAt,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (clientReceiptId != null) 'client_receipt_id': clientReceiptId,
      if (userId != null) 'user_id': userId,
      if (category != null) 'category': category,
      if (severity != null) 'severity': severity,
      if (title != null) 'title': title,
      if (description != null) 'description': description,
      if (screenshotData != null) 'screenshot_data': screenshotData,
      if (deviceInfo != null) 'device_info': deviceInfo,
      if (appVersion != null) 'app_version': appVersion,
      if (route != null) 'route': route,
      if (networkType != null) 'network_type': networkType,
      if (syncStatus != null) 'sync_status': syncStatus,
      if (serverError != null) 'server_error': serverError,
      if (retryCount != null) 'retry_count': retryCount,
      if (lastSentAt != null) 'last_sent_at': lastSentAt,
      if (createdAt != null) 'created_at': createdAt,
      if (rowid != null) 'rowid': rowid,
    });
  }

  SystemReportQueueCompanion copyWith({
    Value<String>? clientReceiptId,
    Value<String>? userId,
    Value<String>? category,
    Value<String>? severity,
    Value<String>? title,
    Value<String>? description,
    Value<String?>? screenshotData,
    Value<String?>? deviceInfo,
    Value<String?>? appVersion,
    Value<String?>? route,
    Value<String?>? networkType,
    Value<OutboxStatus>? syncStatus,
    Value<String?>? serverError,
    Value<int>? retryCount,
    Value<DateTime?>? lastSentAt,
    Value<DateTime>? createdAt,
    Value<int>? rowid,
  }) {
    return SystemReportQueueCompanion(
      clientReceiptId: clientReceiptId ?? this.clientReceiptId,
      userId: userId ?? this.userId,
      category: category ?? this.category,
      severity: severity ?? this.severity,
      title: title ?? this.title,
      description: description ?? this.description,
      screenshotData: screenshotData ?? this.screenshotData,
      deviceInfo: deviceInfo ?? this.deviceInfo,
      appVersion: appVersion ?? this.appVersion,
      route: route ?? this.route,
      networkType: networkType ?? this.networkType,
      syncStatus: syncStatus ?? this.syncStatus,
      serverError: serverError ?? this.serverError,
      retryCount: retryCount ?? this.retryCount,
      lastSentAt: lastSentAt ?? this.lastSentAt,
      createdAt: createdAt ?? this.createdAt,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (clientReceiptId.present) {
      map['client_receipt_id'] = Variable<String>(clientReceiptId.value);
    }
    if (userId.present) {
      map['user_id'] = Variable<String>(userId.value);
    }
    if (category.present) {
      map['category'] = Variable<String>(category.value);
    }
    if (severity.present) {
      map['severity'] = Variable<String>(severity.value);
    }
    if (title.present) {
      map['title'] = Variable<String>(title.value);
    }
    if (description.present) {
      map['description'] = Variable<String>(description.value);
    }
    if (screenshotData.present) {
      map['screenshot_data'] = Variable<String>(screenshotData.value);
    }
    if (deviceInfo.present) {
      map['device_info'] = Variable<String>(deviceInfo.value);
    }
    if (appVersion.present) {
      map['app_version'] = Variable<String>(appVersion.value);
    }
    if (route.present) {
      map['route'] = Variable<String>(route.value);
    }
    if (networkType.present) {
      map['network_type'] = Variable<String>(networkType.value);
    }
    if (syncStatus.present) {
      map['sync_status'] = Variable<String>(
        $SystemReportQueueTable.$convertersyncStatus.toSql(syncStatus.value),
      );
    }
    if (serverError.present) {
      map['server_error'] = Variable<String>(serverError.value);
    }
    if (retryCount.present) {
      map['retry_count'] = Variable<int>(retryCount.value);
    }
    if (lastSentAt.present) {
      map['last_sent_at'] = Variable<DateTime>(lastSentAt.value);
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
    return (StringBuffer('SystemReportQueueCompanion(')
          ..write('clientReceiptId: $clientReceiptId, ')
          ..write('userId: $userId, ')
          ..write('category: $category, ')
          ..write('severity: $severity, ')
          ..write('title: $title, ')
          ..write('description: $description, ')
          ..write('screenshotData: $screenshotData, ')
          ..write('deviceInfo: $deviceInfo, ')
          ..write('appVersion: $appVersion, ')
          ..write('route: $route, ')
          ..write('networkType: $networkType, ')
          ..write('syncStatus: $syncStatus, ')
          ..write('serverError: $serverError, ')
          ..write('retryCount: $retryCount, ')
          ..write('lastSentAt: $lastSentAt, ')
          ..write('createdAt: $createdAt, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $ExcuseQueueTable extends ExcuseQueue
    with TableInfo<$ExcuseQueueTable, ExcuseQueueRow> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $ExcuseQueueTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _clientReceiptIdMeta = const VerificationMeta(
    'clientReceiptId',
  );
  @override
  late final GeneratedColumn<String> clientReceiptId = GeneratedColumn<String>(
    'client_receipt_id',
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
  static const VerificationMeta _recordIdMeta = const VerificationMeta(
    'recordId',
  );
  @override
  late final GeneratedColumn<String> recordId = GeneratedColumn<String>(
    'record_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _reasonMeta = const VerificationMeta('reason');
  @override
  late final GeneratedColumn<String> reason = GeneratedColumn<String>(
    'reason',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _descriptionMeta = const VerificationMeta(
    'description',
  );
  @override
  late final GeneratedColumn<String> description = GeneratedColumn<String>(
    'description',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _evidenceDataMeta = const VerificationMeta(
    'evidenceData',
  );
  @override
  late final GeneratedColumn<String> evidenceData = GeneratedColumn<String>(
    'evidence_data',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  @override
  late final GeneratedColumnWithTypeConverter<OutboxStatus, String> syncStatus =
      GeneratedColumn<String>(
        'sync_status',
        aliasedName,
        false,
        type: DriftSqlType.string,
        requiredDuringInsert: true,
      ).withConverter<OutboxStatus>($ExcuseQueueTable.$convertersyncStatus);
  static const VerificationMeta _serverErrorMeta = const VerificationMeta(
    'serverError',
  );
  @override
  late final GeneratedColumn<String> serverError = GeneratedColumn<String>(
    'server_error',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _retryCountMeta = const VerificationMeta(
    'retryCount',
  );
  @override
  late final GeneratedColumn<int> retryCount = GeneratedColumn<int>(
    'retry_count',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
    defaultValue: const Constant(0),
  );
  static const VerificationMeta _lastSentAtMeta = const VerificationMeta(
    'lastSentAt',
  );
  @override
  late final GeneratedColumn<DateTime> lastSentAt = GeneratedColumn<DateTime>(
    'last_sent_at',
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
    requiredDuringInsert: true,
  );
  @override
  List<GeneratedColumn> get $columns => [
    clientReceiptId,
    userId,
    recordId,
    reason,
    description,
    evidenceData,
    syncStatus,
    serverError,
    retryCount,
    lastSentAt,
    createdAt,
  ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'excuse_queue';
  @override
  VerificationContext validateIntegrity(
    Insertable<ExcuseQueueRow> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('client_receipt_id')) {
      context.handle(
        _clientReceiptIdMeta,
        clientReceiptId.isAcceptableOrUnknown(
          data['client_receipt_id']!,
          _clientReceiptIdMeta,
        ),
      );
    } else if (isInserting) {
      context.missing(_clientReceiptIdMeta);
    }
    if (data.containsKey('user_id')) {
      context.handle(
        _userIdMeta,
        userId.isAcceptableOrUnknown(data['user_id']!, _userIdMeta),
      );
    } else if (isInserting) {
      context.missing(_userIdMeta);
    }
    if (data.containsKey('record_id')) {
      context.handle(
        _recordIdMeta,
        recordId.isAcceptableOrUnknown(data['record_id']!, _recordIdMeta),
      );
    } else if (isInserting) {
      context.missing(_recordIdMeta);
    }
    if (data.containsKey('reason')) {
      context.handle(
        _reasonMeta,
        reason.isAcceptableOrUnknown(data['reason']!, _reasonMeta),
      );
    } else if (isInserting) {
      context.missing(_reasonMeta);
    }
    if (data.containsKey('description')) {
      context.handle(
        _descriptionMeta,
        description.isAcceptableOrUnknown(
          data['description']!,
          _descriptionMeta,
        ),
      );
    } else if (isInserting) {
      context.missing(_descriptionMeta);
    }
    if (data.containsKey('evidence_data')) {
      context.handle(
        _evidenceDataMeta,
        evidenceData.isAcceptableOrUnknown(
          data['evidence_data']!,
          _evidenceDataMeta,
        ),
      );
    }
    if (data.containsKey('server_error')) {
      context.handle(
        _serverErrorMeta,
        serverError.isAcceptableOrUnknown(
          data['server_error']!,
          _serverErrorMeta,
        ),
      );
    }
    if (data.containsKey('retry_count')) {
      context.handle(
        _retryCountMeta,
        retryCount.isAcceptableOrUnknown(data['retry_count']!, _retryCountMeta),
      );
    }
    if (data.containsKey('last_sent_at')) {
      context.handle(
        _lastSentAtMeta,
        lastSentAt.isAcceptableOrUnknown(
          data['last_sent_at']!,
          _lastSentAtMeta,
        ),
      );
    }
    if (data.containsKey('created_at')) {
      context.handle(
        _createdAtMeta,
        createdAt.isAcceptableOrUnknown(data['created_at']!, _createdAtMeta),
      );
    } else if (isInserting) {
      context.missing(_createdAtMeta);
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {clientReceiptId};
  @override
  ExcuseQueueRow map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return ExcuseQueueRow(
      clientReceiptId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}client_receipt_id'],
      )!,
      userId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}user_id'],
      )!,
      recordId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}record_id'],
      )!,
      reason: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}reason'],
      )!,
      description: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}description'],
      )!,
      evidenceData: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}evidence_data'],
      ),
      syncStatus: $ExcuseQueueTable.$convertersyncStatus.fromSql(
        attachedDatabase.typeMapping.read(
          DriftSqlType.string,
          data['${effectivePrefix}sync_status'],
        )!,
      ),
      serverError: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}server_error'],
      ),
      retryCount: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}retry_count'],
      )!,
      lastSentAt: attachedDatabase.typeMapping.read(
        DriftSqlType.dateTime,
        data['${effectivePrefix}last_sent_at'],
      ),
      createdAt: attachedDatabase.typeMapping.read(
        DriftSqlType.dateTime,
        data['${effectivePrefix}created_at'],
      )!,
    );
  }

  @override
  $ExcuseQueueTable createAlias(String alias) {
    return $ExcuseQueueTable(attachedDatabase, alias);
  }

  static TypeConverter<OutboxStatus, String> $convertersyncStatus =
      const OutboxStatusConverter();
}

class ExcuseQueueRow extends DataClass implements Insertable<ExcuseQueueRow> {
  final String clientReceiptId;
  final String userId;
  final String recordId;
  final String reason;
  final String description;
  final String? evidenceData;
  final OutboxStatus syncStatus;
  final String? serverError;
  final int retryCount;
  final DateTime? lastSentAt;
  final DateTime createdAt;
  const ExcuseQueueRow({
    required this.clientReceiptId,
    required this.userId,
    required this.recordId,
    required this.reason,
    required this.description,
    this.evidenceData,
    required this.syncStatus,
    this.serverError,
    required this.retryCount,
    this.lastSentAt,
    required this.createdAt,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['client_receipt_id'] = Variable<String>(clientReceiptId);
    map['user_id'] = Variable<String>(userId);
    map['record_id'] = Variable<String>(recordId);
    map['reason'] = Variable<String>(reason);
    map['description'] = Variable<String>(description);
    if (!nullToAbsent || evidenceData != null) {
      map['evidence_data'] = Variable<String>(evidenceData);
    }
    {
      map['sync_status'] = Variable<String>(
        $ExcuseQueueTable.$convertersyncStatus.toSql(syncStatus),
      );
    }
    if (!nullToAbsent || serverError != null) {
      map['server_error'] = Variable<String>(serverError);
    }
    map['retry_count'] = Variable<int>(retryCount);
    if (!nullToAbsent || lastSentAt != null) {
      map['last_sent_at'] = Variable<DateTime>(lastSentAt);
    }
    map['created_at'] = Variable<DateTime>(createdAt);
    return map;
  }

  ExcuseQueueCompanion toCompanion(bool nullToAbsent) {
    return ExcuseQueueCompanion(
      clientReceiptId: Value(clientReceiptId),
      userId: Value(userId),
      recordId: Value(recordId),
      reason: Value(reason),
      description: Value(description),
      evidenceData: evidenceData == null && nullToAbsent
          ? const Value.absent()
          : Value(evidenceData),
      syncStatus: Value(syncStatus),
      serverError: serverError == null && nullToAbsent
          ? const Value.absent()
          : Value(serverError),
      retryCount: Value(retryCount),
      lastSentAt: lastSentAt == null && nullToAbsent
          ? const Value.absent()
          : Value(lastSentAt),
      createdAt: Value(createdAt),
    );
  }

  factory ExcuseQueueRow.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return ExcuseQueueRow(
      clientReceiptId: serializer.fromJson<String>(json['clientReceiptId']),
      userId: serializer.fromJson<String>(json['userId']),
      recordId: serializer.fromJson<String>(json['recordId']),
      reason: serializer.fromJson<String>(json['reason']),
      description: serializer.fromJson<String>(json['description']),
      evidenceData: serializer.fromJson<String?>(json['evidenceData']),
      syncStatus: serializer.fromJson<OutboxStatus>(json['syncStatus']),
      serverError: serializer.fromJson<String?>(json['serverError']),
      retryCount: serializer.fromJson<int>(json['retryCount']),
      lastSentAt: serializer.fromJson<DateTime?>(json['lastSentAt']),
      createdAt: serializer.fromJson<DateTime>(json['createdAt']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'clientReceiptId': serializer.toJson<String>(clientReceiptId),
      'userId': serializer.toJson<String>(userId),
      'recordId': serializer.toJson<String>(recordId),
      'reason': serializer.toJson<String>(reason),
      'description': serializer.toJson<String>(description),
      'evidenceData': serializer.toJson<String?>(evidenceData),
      'syncStatus': serializer.toJson<OutboxStatus>(syncStatus),
      'serverError': serializer.toJson<String?>(serverError),
      'retryCount': serializer.toJson<int>(retryCount),
      'lastSentAt': serializer.toJson<DateTime?>(lastSentAt),
      'createdAt': serializer.toJson<DateTime>(createdAt),
    };
  }

  ExcuseQueueRow copyWith({
    String? clientReceiptId,
    String? userId,
    String? recordId,
    String? reason,
    String? description,
    Value<String?> evidenceData = const Value.absent(),
    OutboxStatus? syncStatus,
    Value<String?> serverError = const Value.absent(),
    int? retryCount,
    Value<DateTime?> lastSentAt = const Value.absent(),
    DateTime? createdAt,
  }) => ExcuseQueueRow(
    clientReceiptId: clientReceiptId ?? this.clientReceiptId,
    userId: userId ?? this.userId,
    recordId: recordId ?? this.recordId,
    reason: reason ?? this.reason,
    description: description ?? this.description,
    evidenceData: evidenceData.present ? evidenceData.value : this.evidenceData,
    syncStatus: syncStatus ?? this.syncStatus,
    serverError: serverError.present ? serverError.value : this.serverError,
    retryCount: retryCount ?? this.retryCount,
    lastSentAt: lastSentAt.present ? lastSentAt.value : this.lastSentAt,
    createdAt: createdAt ?? this.createdAt,
  );
  ExcuseQueueRow copyWithCompanion(ExcuseQueueCompanion data) {
    return ExcuseQueueRow(
      clientReceiptId: data.clientReceiptId.present
          ? data.clientReceiptId.value
          : this.clientReceiptId,
      userId: data.userId.present ? data.userId.value : this.userId,
      recordId: data.recordId.present ? data.recordId.value : this.recordId,
      reason: data.reason.present ? data.reason.value : this.reason,
      description: data.description.present
          ? data.description.value
          : this.description,
      evidenceData: data.evidenceData.present
          ? data.evidenceData.value
          : this.evidenceData,
      syncStatus: data.syncStatus.present
          ? data.syncStatus.value
          : this.syncStatus,
      serverError: data.serverError.present
          ? data.serverError.value
          : this.serverError,
      retryCount: data.retryCount.present
          ? data.retryCount.value
          : this.retryCount,
      lastSentAt: data.lastSentAt.present
          ? data.lastSentAt.value
          : this.lastSentAt,
      createdAt: data.createdAt.present ? data.createdAt.value : this.createdAt,
    );
  }

  @override
  String toString() {
    return (StringBuffer('ExcuseQueueRow(')
          ..write('clientReceiptId: $clientReceiptId, ')
          ..write('userId: $userId, ')
          ..write('recordId: $recordId, ')
          ..write('reason: $reason, ')
          ..write('description: $description, ')
          ..write('evidenceData: $evidenceData, ')
          ..write('syncStatus: $syncStatus, ')
          ..write('serverError: $serverError, ')
          ..write('retryCount: $retryCount, ')
          ..write('lastSentAt: $lastSentAt, ')
          ..write('createdAt: $createdAt')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(
    clientReceiptId,
    userId,
    recordId,
    reason,
    description,
    evidenceData,
    syncStatus,
    serverError,
    retryCount,
    lastSentAt,
    createdAt,
  );
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is ExcuseQueueRow &&
          other.clientReceiptId == this.clientReceiptId &&
          other.userId == this.userId &&
          other.recordId == this.recordId &&
          other.reason == this.reason &&
          other.description == this.description &&
          other.evidenceData == this.evidenceData &&
          other.syncStatus == this.syncStatus &&
          other.serverError == this.serverError &&
          other.retryCount == this.retryCount &&
          other.lastSentAt == this.lastSentAt &&
          other.createdAt == this.createdAt);
}

class ExcuseQueueCompanion extends UpdateCompanion<ExcuseQueueRow> {
  final Value<String> clientReceiptId;
  final Value<String> userId;
  final Value<String> recordId;
  final Value<String> reason;
  final Value<String> description;
  final Value<String?> evidenceData;
  final Value<OutboxStatus> syncStatus;
  final Value<String?> serverError;
  final Value<int> retryCount;
  final Value<DateTime?> lastSentAt;
  final Value<DateTime> createdAt;
  final Value<int> rowid;
  const ExcuseQueueCompanion({
    this.clientReceiptId = const Value.absent(),
    this.userId = const Value.absent(),
    this.recordId = const Value.absent(),
    this.reason = const Value.absent(),
    this.description = const Value.absent(),
    this.evidenceData = const Value.absent(),
    this.syncStatus = const Value.absent(),
    this.serverError = const Value.absent(),
    this.retryCount = const Value.absent(),
    this.lastSentAt = const Value.absent(),
    this.createdAt = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  ExcuseQueueCompanion.insert({
    required String clientReceiptId,
    required String userId,
    required String recordId,
    required String reason,
    required String description,
    this.evidenceData = const Value.absent(),
    required OutboxStatus syncStatus,
    this.serverError = const Value.absent(),
    this.retryCount = const Value.absent(),
    this.lastSentAt = const Value.absent(),
    required DateTime createdAt,
    this.rowid = const Value.absent(),
  }) : clientReceiptId = Value(clientReceiptId),
       userId = Value(userId),
       recordId = Value(recordId),
       reason = Value(reason),
       description = Value(description),
       syncStatus = Value(syncStatus),
       createdAt = Value(createdAt);
  static Insertable<ExcuseQueueRow> custom({
    Expression<String>? clientReceiptId,
    Expression<String>? userId,
    Expression<String>? recordId,
    Expression<String>? reason,
    Expression<String>? description,
    Expression<String>? evidenceData,
    Expression<String>? syncStatus,
    Expression<String>? serverError,
    Expression<int>? retryCount,
    Expression<DateTime>? lastSentAt,
    Expression<DateTime>? createdAt,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (clientReceiptId != null) 'client_receipt_id': clientReceiptId,
      if (userId != null) 'user_id': userId,
      if (recordId != null) 'record_id': recordId,
      if (reason != null) 'reason': reason,
      if (description != null) 'description': description,
      if (evidenceData != null) 'evidence_data': evidenceData,
      if (syncStatus != null) 'sync_status': syncStatus,
      if (serverError != null) 'server_error': serverError,
      if (retryCount != null) 'retry_count': retryCount,
      if (lastSentAt != null) 'last_sent_at': lastSentAt,
      if (createdAt != null) 'created_at': createdAt,
      if (rowid != null) 'rowid': rowid,
    });
  }

  ExcuseQueueCompanion copyWith({
    Value<String>? clientReceiptId,
    Value<String>? userId,
    Value<String>? recordId,
    Value<String>? reason,
    Value<String>? description,
    Value<String?>? evidenceData,
    Value<OutboxStatus>? syncStatus,
    Value<String?>? serverError,
    Value<int>? retryCount,
    Value<DateTime?>? lastSentAt,
    Value<DateTime>? createdAt,
    Value<int>? rowid,
  }) {
    return ExcuseQueueCompanion(
      clientReceiptId: clientReceiptId ?? this.clientReceiptId,
      userId: userId ?? this.userId,
      recordId: recordId ?? this.recordId,
      reason: reason ?? this.reason,
      description: description ?? this.description,
      evidenceData: evidenceData ?? this.evidenceData,
      syncStatus: syncStatus ?? this.syncStatus,
      serverError: serverError ?? this.serverError,
      retryCount: retryCount ?? this.retryCount,
      lastSentAt: lastSentAt ?? this.lastSentAt,
      createdAt: createdAt ?? this.createdAt,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (clientReceiptId.present) {
      map['client_receipt_id'] = Variable<String>(clientReceiptId.value);
    }
    if (userId.present) {
      map['user_id'] = Variable<String>(userId.value);
    }
    if (recordId.present) {
      map['record_id'] = Variable<String>(recordId.value);
    }
    if (reason.present) {
      map['reason'] = Variable<String>(reason.value);
    }
    if (description.present) {
      map['description'] = Variable<String>(description.value);
    }
    if (evidenceData.present) {
      map['evidence_data'] = Variable<String>(evidenceData.value);
    }
    if (syncStatus.present) {
      map['sync_status'] = Variable<String>(
        $ExcuseQueueTable.$convertersyncStatus.toSql(syncStatus.value),
      );
    }
    if (serverError.present) {
      map['server_error'] = Variable<String>(serverError.value);
    }
    if (retryCount.present) {
      map['retry_count'] = Variable<int>(retryCount.value);
    }
    if (lastSentAt.present) {
      map['last_sent_at'] = Variable<DateTime>(lastSentAt.value);
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
    return (StringBuffer('ExcuseQueueCompanion(')
          ..write('clientReceiptId: $clientReceiptId, ')
          ..write('userId: $userId, ')
          ..write('recordId: $recordId, ')
          ..write('reason: $reason, ')
          ..write('description: $description, ')
          ..write('evidenceData: $evidenceData, ')
          ..write('syncStatus: $syncStatus, ')
          ..write('serverError: $serverError, ')
          ..write('retryCount: $retryCount, ')
          ..write('lastSentAt: $lastSentAt, ')
          ..write('createdAt: $createdAt, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $NotificationsInboxTable extends NotificationsInbox
    with TableInfo<$NotificationsInboxTable, NotificationInboxRow> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $NotificationsInboxTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _userIdMeta = const VerificationMeta('userId');
  @override
  late final GeneratedColumn<String> userId = GeneratedColumn<String>(
    'user_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _notificationIdMeta = const VerificationMeta(
    'notificationId',
  );
  @override
  late final GeneratedColumn<String> notificationId = GeneratedColumn<String>(
    'notification_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  @override
  late final GeneratedColumnWithTypeConverter<NotificationType, String> type =
      GeneratedColumn<String>(
        'type',
        aliasedName,
        false,
        type: DriftSqlType.string,
        requiredDuringInsert: true,
      ).withConverter<NotificationType>(
        $NotificationsInboxTable.$convertertype,
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
  static const VerificationMeta _bodyMeta = const VerificationMeta('body');
  @override
  late final GeneratedColumn<String> body = GeneratedColumn<String>(
    'body',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
    defaultValue: const Constant(''),
  );
  static const VerificationMeta _payloadJsonMeta = const VerificationMeta(
    'payloadJson',
  );
  @override
  late final GeneratedColumn<String> payloadJson = GeneratedColumn<String>(
    'payload_json',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _readAtMeta = const VerificationMeta('readAt');
  @override
  late final GeneratedColumn<DateTime> readAt = GeneratedColumn<DateTime>(
    'read_at',
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
    requiredDuringInsert: true,
  );
  static const VerificationMeta _deepLinkMeta = const VerificationMeta(
    'deepLink',
  );
  @override
  late final GeneratedColumn<String> deepLink = GeneratedColumn<String>(
    'deep_link',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  @override
  List<GeneratedColumn> get $columns => [
    userId,
    notificationId,
    type,
    title,
    body,
    payloadJson,
    readAt,
    createdAt,
    deepLink,
  ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'notifications_inbox';
  @override
  VerificationContext validateIntegrity(
    Insertable<NotificationInboxRow> instance, {
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
    if (data.containsKey('notification_id')) {
      context.handle(
        _notificationIdMeta,
        notificationId.isAcceptableOrUnknown(
          data['notification_id']!,
          _notificationIdMeta,
        ),
      );
    } else if (isInserting) {
      context.missing(_notificationIdMeta);
    }
    if (data.containsKey('title')) {
      context.handle(
        _titleMeta,
        title.isAcceptableOrUnknown(data['title']!, _titleMeta),
      );
    }
    if (data.containsKey('body')) {
      context.handle(
        _bodyMeta,
        body.isAcceptableOrUnknown(data['body']!, _bodyMeta),
      );
    }
    if (data.containsKey('payload_json')) {
      context.handle(
        _payloadJsonMeta,
        payloadJson.isAcceptableOrUnknown(
          data['payload_json']!,
          _payloadJsonMeta,
        ),
      );
    } else if (isInserting) {
      context.missing(_payloadJsonMeta);
    }
    if (data.containsKey('read_at')) {
      context.handle(
        _readAtMeta,
        readAt.isAcceptableOrUnknown(data['read_at']!, _readAtMeta),
      );
    }
    if (data.containsKey('created_at')) {
      context.handle(
        _createdAtMeta,
        createdAt.isAcceptableOrUnknown(data['created_at']!, _createdAtMeta),
      );
    } else if (isInserting) {
      context.missing(_createdAtMeta);
    }
    if (data.containsKey('deep_link')) {
      context.handle(
        _deepLinkMeta,
        deepLink.isAcceptableOrUnknown(data['deep_link']!, _deepLinkMeta),
      );
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {userId, notificationId};
  @override
  NotificationInboxRow map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return NotificationInboxRow(
      userId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}user_id'],
      )!,
      notificationId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}notification_id'],
      )!,
      type: $NotificationsInboxTable.$convertertype.fromSql(
        attachedDatabase.typeMapping.read(
          DriftSqlType.string,
          data['${effectivePrefix}type'],
        )!,
      ),
      title: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}title'],
      )!,
      body: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}body'],
      )!,
      payloadJson: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}payload_json'],
      )!,
      readAt: attachedDatabase.typeMapping.read(
        DriftSqlType.dateTime,
        data['${effectivePrefix}read_at'],
      ),
      createdAt: attachedDatabase.typeMapping.read(
        DriftSqlType.dateTime,
        data['${effectivePrefix}created_at'],
      )!,
      deepLink: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}deep_link'],
      ),
    );
  }

  @override
  $NotificationsInboxTable createAlias(String alias) {
    return $NotificationsInboxTable(attachedDatabase, alias);
  }

  static TypeConverter<NotificationType, String> $convertertype =
      const NotificationTypeColumnConverter();
}

class NotificationInboxRow extends DataClass
    implements Insertable<NotificationInboxRow> {
  final String userId;
  final String notificationId;
  final NotificationType type;
  final String title;
  final String body;
  final String payloadJson;
  final DateTime? readAt;
  final DateTime createdAt;
  final String? deepLink;
  const NotificationInboxRow({
    required this.userId,
    required this.notificationId,
    required this.type,
    required this.title,
    required this.body,
    required this.payloadJson,
    this.readAt,
    required this.createdAt,
    this.deepLink,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['user_id'] = Variable<String>(userId);
    map['notification_id'] = Variable<String>(notificationId);
    {
      map['type'] = Variable<String>(
        $NotificationsInboxTable.$convertertype.toSql(type),
      );
    }
    map['title'] = Variable<String>(title);
    map['body'] = Variable<String>(body);
    map['payload_json'] = Variable<String>(payloadJson);
    if (!nullToAbsent || readAt != null) {
      map['read_at'] = Variable<DateTime>(readAt);
    }
    map['created_at'] = Variable<DateTime>(createdAt);
    if (!nullToAbsent || deepLink != null) {
      map['deep_link'] = Variable<String>(deepLink);
    }
    return map;
  }

  NotificationsInboxCompanion toCompanion(bool nullToAbsent) {
    return NotificationsInboxCompanion(
      userId: Value(userId),
      notificationId: Value(notificationId),
      type: Value(type),
      title: Value(title),
      body: Value(body),
      payloadJson: Value(payloadJson),
      readAt: readAt == null && nullToAbsent
          ? const Value.absent()
          : Value(readAt),
      createdAt: Value(createdAt),
      deepLink: deepLink == null && nullToAbsent
          ? const Value.absent()
          : Value(deepLink),
    );
  }

  factory NotificationInboxRow.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return NotificationInboxRow(
      userId: serializer.fromJson<String>(json['userId']),
      notificationId: serializer.fromJson<String>(json['notificationId']),
      type: serializer.fromJson<NotificationType>(json['type']),
      title: serializer.fromJson<String>(json['title']),
      body: serializer.fromJson<String>(json['body']),
      payloadJson: serializer.fromJson<String>(json['payloadJson']),
      readAt: serializer.fromJson<DateTime?>(json['readAt']),
      createdAt: serializer.fromJson<DateTime>(json['createdAt']),
      deepLink: serializer.fromJson<String?>(json['deepLink']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'userId': serializer.toJson<String>(userId),
      'notificationId': serializer.toJson<String>(notificationId),
      'type': serializer.toJson<NotificationType>(type),
      'title': serializer.toJson<String>(title),
      'body': serializer.toJson<String>(body),
      'payloadJson': serializer.toJson<String>(payloadJson),
      'readAt': serializer.toJson<DateTime?>(readAt),
      'createdAt': serializer.toJson<DateTime>(createdAt),
      'deepLink': serializer.toJson<String?>(deepLink),
    };
  }

  NotificationInboxRow copyWith({
    String? userId,
    String? notificationId,
    NotificationType? type,
    String? title,
    String? body,
    String? payloadJson,
    Value<DateTime?> readAt = const Value.absent(),
    DateTime? createdAt,
    Value<String?> deepLink = const Value.absent(),
  }) => NotificationInboxRow(
    userId: userId ?? this.userId,
    notificationId: notificationId ?? this.notificationId,
    type: type ?? this.type,
    title: title ?? this.title,
    body: body ?? this.body,
    payloadJson: payloadJson ?? this.payloadJson,
    readAt: readAt.present ? readAt.value : this.readAt,
    createdAt: createdAt ?? this.createdAt,
    deepLink: deepLink.present ? deepLink.value : this.deepLink,
  );
  NotificationInboxRow copyWithCompanion(NotificationsInboxCompanion data) {
    return NotificationInboxRow(
      userId: data.userId.present ? data.userId.value : this.userId,
      notificationId: data.notificationId.present
          ? data.notificationId.value
          : this.notificationId,
      type: data.type.present ? data.type.value : this.type,
      title: data.title.present ? data.title.value : this.title,
      body: data.body.present ? data.body.value : this.body,
      payloadJson: data.payloadJson.present
          ? data.payloadJson.value
          : this.payloadJson,
      readAt: data.readAt.present ? data.readAt.value : this.readAt,
      createdAt: data.createdAt.present ? data.createdAt.value : this.createdAt,
      deepLink: data.deepLink.present ? data.deepLink.value : this.deepLink,
    );
  }

  @override
  String toString() {
    return (StringBuffer('NotificationInboxRow(')
          ..write('userId: $userId, ')
          ..write('notificationId: $notificationId, ')
          ..write('type: $type, ')
          ..write('title: $title, ')
          ..write('body: $body, ')
          ..write('payloadJson: $payloadJson, ')
          ..write('readAt: $readAt, ')
          ..write('createdAt: $createdAt, ')
          ..write('deepLink: $deepLink')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(
    userId,
    notificationId,
    type,
    title,
    body,
    payloadJson,
    readAt,
    createdAt,
    deepLink,
  );
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is NotificationInboxRow &&
          other.userId == this.userId &&
          other.notificationId == this.notificationId &&
          other.type == this.type &&
          other.title == this.title &&
          other.body == this.body &&
          other.payloadJson == this.payloadJson &&
          other.readAt == this.readAt &&
          other.createdAt == this.createdAt &&
          other.deepLink == this.deepLink);
}

class NotificationsInboxCompanion
    extends UpdateCompanion<NotificationInboxRow> {
  final Value<String> userId;
  final Value<String> notificationId;
  final Value<NotificationType> type;
  final Value<String> title;
  final Value<String> body;
  final Value<String> payloadJson;
  final Value<DateTime?> readAt;
  final Value<DateTime> createdAt;
  final Value<String?> deepLink;
  final Value<int> rowid;
  const NotificationsInboxCompanion({
    this.userId = const Value.absent(),
    this.notificationId = const Value.absent(),
    this.type = const Value.absent(),
    this.title = const Value.absent(),
    this.body = const Value.absent(),
    this.payloadJson = const Value.absent(),
    this.readAt = const Value.absent(),
    this.createdAt = const Value.absent(),
    this.deepLink = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  NotificationsInboxCompanion.insert({
    required String userId,
    required String notificationId,
    required NotificationType type,
    this.title = const Value.absent(),
    this.body = const Value.absent(),
    required String payloadJson,
    this.readAt = const Value.absent(),
    required DateTime createdAt,
    this.deepLink = const Value.absent(),
    this.rowid = const Value.absent(),
  }) : userId = Value(userId),
       notificationId = Value(notificationId),
       type = Value(type),
       payloadJson = Value(payloadJson),
       createdAt = Value(createdAt);
  static Insertable<NotificationInboxRow> custom({
    Expression<String>? userId,
    Expression<String>? notificationId,
    Expression<String>? type,
    Expression<String>? title,
    Expression<String>? body,
    Expression<String>? payloadJson,
    Expression<DateTime>? readAt,
    Expression<DateTime>? createdAt,
    Expression<String>? deepLink,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (userId != null) 'user_id': userId,
      if (notificationId != null) 'notification_id': notificationId,
      if (type != null) 'type': type,
      if (title != null) 'title': title,
      if (body != null) 'body': body,
      if (payloadJson != null) 'payload_json': payloadJson,
      if (readAt != null) 'read_at': readAt,
      if (createdAt != null) 'created_at': createdAt,
      if (deepLink != null) 'deep_link': deepLink,
      if (rowid != null) 'rowid': rowid,
    });
  }

  NotificationsInboxCompanion copyWith({
    Value<String>? userId,
    Value<String>? notificationId,
    Value<NotificationType>? type,
    Value<String>? title,
    Value<String>? body,
    Value<String>? payloadJson,
    Value<DateTime?>? readAt,
    Value<DateTime>? createdAt,
    Value<String?>? deepLink,
    Value<int>? rowid,
  }) {
    return NotificationsInboxCompanion(
      userId: userId ?? this.userId,
      notificationId: notificationId ?? this.notificationId,
      type: type ?? this.type,
      title: title ?? this.title,
      body: body ?? this.body,
      payloadJson: payloadJson ?? this.payloadJson,
      readAt: readAt ?? this.readAt,
      createdAt: createdAt ?? this.createdAt,
      deepLink: deepLink ?? this.deepLink,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (userId.present) {
      map['user_id'] = Variable<String>(userId.value);
    }
    if (notificationId.present) {
      map['notification_id'] = Variable<String>(notificationId.value);
    }
    if (type.present) {
      map['type'] = Variable<String>(
        $NotificationsInboxTable.$convertertype.toSql(type.value),
      );
    }
    if (title.present) {
      map['title'] = Variable<String>(title.value);
    }
    if (body.present) {
      map['body'] = Variable<String>(body.value);
    }
    if (payloadJson.present) {
      map['payload_json'] = Variable<String>(payloadJson.value);
    }
    if (readAt.present) {
      map['read_at'] = Variable<DateTime>(readAt.value);
    }
    if (createdAt.present) {
      map['created_at'] = Variable<DateTime>(createdAt.value);
    }
    if (deepLink.present) {
      map['deep_link'] = Variable<String>(deepLink.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('NotificationsInboxCompanion(')
          ..write('userId: $userId, ')
          ..write('notificationId: $notificationId, ')
          ..write('type: $type, ')
          ..write('title: $title, ')
          ..write('body: $body, ')
          ..write('payloadJson: $payloadJson, ')
          ..write('readAt: $readAt, ')
          ..write('createdAt: $createdAt, ')
          ..write('deepLink: $deepLink, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $CachedMetaTable extends CachedMeta
    with TableInfo<$CachedMetaTable, CachedMetaRow> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $CachedMetaTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _userIdMeta = const VerificationMeta('userId');
  @override
  late final GeneratedColumn<String> userId = GeneratedColumn<String>(
    'user_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _clockOffsetMsMeta = const VerificationMeta(
    'clockOffsetMs',
  );
  @override
  late final GeneratedColumn<int> clockOffsetMs = GeneratedColumn<int>(
    'clock_offset_ms',
    aliasedName,
    true,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _clockOffsetUpdatedAtMeta =
      const VerificationMeta('clockOffsetUpdatedAt');
  @override
  late final GeneratedColumn<DateTime> clockOffsetUpdatedAt =
      GeneratedColumn<DateTime>(
        'clock_offset_updated_at',
        aliasedName,
        true,
        type: DriftSqlType.dateTime,
        requiredDuringInsert: false,
      );
  static const VerificationMeta _lastSyncAtMeta = const VerificationMeta(
    'lastSyncAt',
  );
  @override
  late final GeneratedColumn<DateTime> lastSyncAt = GeneratedColumn<DateTime>(
    'last_sync_at',
    aliasedName,
    true,
    type: DriftSqlType.dateTime,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _enrolledSectionIdsJsonMeta =
      const VerificationMeta('enrolledSectionIdsJson');
  @override
  late final GeneratedColumn<String> enrolledSectionIdsJson =
      GeneratedColumn<String>(
        'enrolled_section_ids_json',
        aliasedName,
        true,
        type: DriftSqlType.string,
        requiredDuringInsert: false,
      );
  static const VerificationMeta _profileJsonMeta = const VerificationMeta(
    'profileJson',
  );
  @override
  late final GeneratedColumn<String> profileJson = GeneratedColumn<String>(
    'profile_json',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _activeProfileUserIdMeta =
      const VerificationMeta('activeProfileUserId');
  @override
  late final GeneratedColumn<String> activeProfileUserId =
      GeneratedColumn<String>(
        'active_profile_user_id',
        aliasedName,
        true,
        type: DriftSqlType.string,
        requiredDuringInsert: false,
      );
  @override
  List<GeneratedColumn> get $columns => [
    userId,
    clockOffsetMs,
    clockOffsetUpdatedAt,
    lastSyncAt,
    enrolledSectionIdsJson,
    profileJson,
    activeProfileUserId,
  ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'cached_meta';
  @override
  VerificationContext validateIntegrity(
    Insertable<CachedMetaRow> instance, {
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
    if (data.containsKey('clock_offset_ms')) {
      context.handle(
        _clockOffsetMsMeta,
        clockOffsetMs.isAcceptableOrUnknown(
          data['clock_offset_ms']!,
          _clockOffsetMsMeta,
        ),
      );
    }
    if (data.containsKey('clock_offset_updated_at')) {
      context.handle(
        _clockOffsetUpdatedAtMeta,
        clockOffsetUpdatedAt.isAcceptableOrUnknown(
          data['clock_offset_updated_at']!,
          _clockOffsetUpdatedAtMeta,
        ),
      );
    }
    if (data.containsKey('last_sync_at')) {
      context.handle(
        _lastSyncAtMeta,
        lastSyncAt.isAcceptableOrUnknown(
          data['last_sync_at']!,
          _lastSyncAtMeta,
        ),
      );
    }
    if (data.containsKey('enrolled_section_ids_json')) {
      context.handle(
        _enrolledSectionIdsJsonMeta,
        enrolledSectionIdsJson.isAcceptableOrUnknown(
          data['enrolled_section_ids_json']!,
          _enrolledSectionIdsJsonMeta,
        ),
      );
    }
    if (data.containsKey('profile_json')) {
      context.handle(
        _profileJsonMeta,
        profileJson.isAcceptableOrUnknown(
          data['profile_json']!,
          _profileJsonMeta,
        ),
      );
    }
    if (data.containsKey('active_profile_user_id')) {
      context.handle(
        _activeProfileUserIdMeta,
        activeProfileUserId.isAcceptableOrUnknown(
          data['active_profile_user_id']!,
          _activeProfileUserIdMeta,
        ),
      );
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {userId};
  @override
  CachedMetaRow map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return CachedMetaRow(
      userId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}user_id'],
      )!,
      clockOffsetMs: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}clock_offset_ms'],
      ),
      clockOffsetUpdatedAt: attachedDatabase.typeMapping.read(
        DriftSqlType.dateTime,
        data['${effectivePrefix}clock_offset_updated_at'],
      ),
      lastSyncAt: attachedDatabase.typeMapping.read(
        DriftSqlType.dateTime,
        data['${effectivePrefix}last_sync_at'],
      ),
      enrolledSectionIdsJson: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}enrolled_section_ids_json'],
      ),
      profileJson: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}profile_json'],
      ),
      activeProfileUserId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}active_profile_user_id'],
      ),
    );
  }

  @override
  $CachedMetaTable createAlias(String alias) {
    return $CachedMetaTable(attachedDatabase, alias);
  }
}

class CachedMetaRow extends DataClass implements Insertable<CachedMetaRow> {
  final String userId;
  final int? clockOffsetMs;
  final DateTime? clockOffsetUpdatedAt;
  final DateTime? lastSyncAt;
  final String? enrolledSectionIdsJson;
  final String? profileJson;
  final String? activeProfileUserId;
  const CachedMetaRow({
    required this.userId,
    this.clockOffsetMs,
    this.clockOffsetUpdatedAt,
    this.lastSyncAt,
    this.enrolledSectionIdsJson,
    this.profileJson,
    this.activeProfileUserId,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['user_id'] = Variable<String>(userId);
    if (!nullToAbsent || clockOffsetMs != null) {
      map['clock_offset_ms'] = Variable<int>(clockOffsetMs);
    }
    if (!nullToAbsent || clockOffsetUpdatedAt != null) {
      map['clock_offset_updated_at'] = Variable<DateTime>(clockOffsetUpdatedAt);
    }
    if (!nullToAbsent || lastSyncAt != null) {
      map['last_sync_at'] = Variable<DateTime>(lastSyncAt);
    }
    if (!nullToAbsent || enrolledSectionIdsJson != null) {
      map['enrolled_section_ids_json'] = Variable<String>(
        enrolledSectionIdsJson,
      );
    }
    if (!nullToAbsent || profileJson != null) {
      map['profile_json'] = Variable<String>(profileJson);
    }
    if (!nullToAbsent || activeProfileUserId != null) {
      map['active_profile_user_id'] = Variable<String>(activeProfileUserId);
    }
    return map;
  }

  CachedMetaCompanion toCompanion(bool nullToAbsent) {
    return CachedMetaCompanion(
      userId: Value(userId),
      clockOffsetMs: clockOffsetMs == null && nullToAbsent
          ? const Value.absent()
          : Value(clockOffsetMs),
      clockOffsetUpdatedAt: clockOffsetUpdatedAt == null && nullToAbsent
          ? const Value.absent()
          : Value(clockOffsetUpdatedAt),
      lastSyncAt: lastSyncAt == null && nullToAbsent
          ? const Value.absent()
          : Value(lastSyncAt),
      enrolledSectionIdsJson: enrolledSectionIdsJson == null && nullToAbsent
          ? const Value.absent()
          : Value(enrolledSectionIdsJson),
      profileJson: profileJson == null && nullToAbsent
          ? const Value.absent()
          : Value(profileJson),
      activeProfileUserId: activeProfileUserId == null && nullToAbsent
          ? const Value.absent()
          : Value(activeProfileUserId),
    );
  }

  factory CachedMetaRow.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return CachedMetaRow(
      userId: serializer.fromJson<String>(json['userId']),
      clockOffsetMs: serializer.fromJson<int?>(json['clockOffsetMs']),
      clockOffsetUpdatedAt: serializer.fromJson<DateTime?>(
        json['clockOffsetUpdatedAt'],
      ),
      lastSyncAt: serializer.fromJson<DateTime?>(json['lastSyncAt']),
      enrolledSectionIdsJson: serializer.fromJson<String?>(
        json['enrolledSectionIdsJson'],
      ),
      profileJson: serializer.fromJson<String?>(json['profileJson']),
      activeProfileUserId: serializer.fromJson<String?>(
        json['activeProfileUserId'],
      ),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'userId': serializer.toJson<String>(userId),
      'clockOffsetMs': serializer.toJson<int?>(clockOffsetMs),
      'clockOffsetUpdatedAt': serializer.toJson<DateTime?>(
        clockOffsetUpdatedAt,
      ),
      'lastSyncAt': serializer.toJson<DateTime?>(lastSyncAt),
      'enrolledSectionIdsJson': serializer.toJson<String?>(
        enrolledSectionIdsJson,
      ),
      'profileJson': serializer.toJson<String?>(profileJson),
      'activeProfileUserId': serializer.toJson<String?>(activeProfileUserId),
    };
  }

  CachedMetaRow copyWith({
    String? userId,
    Value<int?> clockOffsetMs = const Value.absent(),
    Value<DateTime?> clockOffsetUpdatedAt = const Value.absent(),
    Value<DateTime?> lastSyncAt = const Value.absent(),
    Value<String?> enrolledSectionIdsJson = const Value.absent(),
    Value<String?> profileJson = const Value.absent(),
    Value<String?> activeProfileUserId = const Value.absent(),
  }) => CachedMetaRow(
    userId: userId ?? this.userId,
    clockOffsetMs: clockOffsetMs.present
        ? clockOffsetMs.value
        : this.clockOffsetMs,
    clockOffsetUpdatedAt: clockOffsetUpdatedAt.present
        ? clockOffsetUpdatedAt.value
        : this.clockOffsetUpdatedAt,
    lastSyncAt: lastSyncAt.present ? lastSyncAt.value : this.lastSyncAt,
    enrolledSectionIdsJson: enrolledSectionIdsJson.present
        ? enrolledSectionIdsJson.value
        : this.enrolledSectionIdsJson,
    profileJson: profileJson.present ? profileJson.value : this.profileJson,
    activeProfileUserId: activeProfileUserId.present
        ? activeProfileUserId.value
        : this.activeProfileUserId,
  );
  CachedMetaRow copyWithCompanion(CachedMetaCompanion data) {
    return CachedMetaRow(
      userId: data.userId.present ? data.userId.value : this.userId,
      clockOffsetMs: data.clockOffsetMs.present
          ? data.clockOffsetMs.value
          : this.clockOffsetMs,
      clockOffsetUpdatedAt: data.clockOffsetUpdatedAt.present
          ? data.clockOffsetUpdatedAt.value
          : this.clockOffsetUpdatedAt,
      lastSyncAt: data.lastSyncAt.present
          ? data.lastSyncAt.value
          : this.lastSyncAt,
      enrolledSectionIdsJson: data.enrolledSectionIdsJson.present
          ? data.enrolledSectionIdsJson.value
          : this.enrolledSectionIdsJson,
      profileJson: data.profileJson.present
          ? data.profileJson.value
          : this.profileJson,
      activeProfileUserId: data.activeProfileUserId.present
          ? data.activeProfileUserId.value
          : this.activeProfileUserId,
    );
  }

  @override
  String toString() {
    return (StringBuffer('CachedMetaRow(')
          ..write('userId: $userId, ')
          ..write('clockOffsetMs: $clockOffsetMs, ')
          ..write('clockOffsetUpdatedAt: $clockOffsetUpdatedAt, ')
          ..write('lastSyncAt: $lastSyncAt, ')
          ..write('enrolledSectionIdsJson: $enrolledSectionIdsJson, ')
          ..write('profileJson: $profileJson, ')
          ..write('activeProfileUserId: $activeProfileUserId')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(
    userId,
    clockOffsetMs,
    clockOffsetUpdatedAt,
    lastSyncAt,
    enrolledSectionIdsJson,
    profileJson,
    activeProfileUserId,
  );
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is CachedMetaRow &&
          other.userId == this.userId &&
          other.clockOffsetMs == this.clockOffsetMs &&
          other.clockOffsetUpdatedAt == this.clockOffsetUpdatedAt &&
          other.lastSyncAt == this.lastSyncAt &&
          other.enrolledSectionIdsJson == this.enrolledSectionIdsJson &&
          other.profileJson == this.profileJson &&
          other.activeProfileUserId == this.activeProfileUserId);
}

class CachedMetaCompanion extends UpdateCompanion<CachedMetaRow> {
  final Value<String> userId;
  final Value<int?> clockOffsetMs;
  final Value<DateTime?> clockOffsetUpdatedAt;
  final Value<DateTime?> lastSyncAt;
  final Value<String?> enrolledSectionIdsJson;
  final Value<String?> profileJson;
  final Value<String?> activeProfileUserId;
  final Value<int> rowid;
  const CachedMetaCompanion({
    this.userId = const Value.absent(),
    this.clockOffsetMs = const Value.absent(),
    this.clockOffsetUpdatedAt = const Value.absent(),
    this.lastSyncAt = const Value.absent(),
    this.enrolledSectionIdsJson = const Value.absent(),
    this.profileJson = const Value.absent(),
    this.activeProfileUserId = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  CachedMetaCompanion.insert({
    required String userId,
    this.clockOffsetMs = const Value.absent(),
    this.clockOffsetUpdatedAt = const Value.absent(),
    this.lastSyncAt = const Value.absent(),
    this.enrolledSectionIdsJson = const Value.absent(),
    this.profileJson = const Value.absent(),
    this.activeProfileUserId = const Value.absent(),
    this.rowid = const Value.absent(),
  }) : userId = Value(userId);
  static Insertable<CachedMetaRow> custom({
    Expression<String>? userId,
    Expression<int>? clockOffsetMs,
    Expression<DateTime>? clockOffsetUpdatedAt,
    Expression<DateTime>? lastSyncAt,
    Expression<String>? enrolledSectionIdsJson,
    Expression<String>? profileJson,
    Expression<String>? activeProfileUserId,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (userId != null) 'user_id': userId,
      if (clockOffsetMs != null) 'clock_offset_ms': clockOffsetMs,
      if (clockOffsetUpdatedAt != null)
        'clock_offset_updated_at': clockOffsetUpdatedAt,
      if (lastSyncAt != null) 'last_sync_at': lastSyncAt,
      if (enrolledSectionIdsJson != null)
        'enrolled_section_ids_json': enrolledSectionIdsJson,
      if (profileJson != null) 'profile_json': profileJson,
      if (activeProfileUserId != null)
        'active_profile_user_id': activeProfileUserId,
      if (rowid != null) 'rowid': rowid,
    });
  }

  CachedMetaCompanion copyWith({
    Value<String>? userId,
    Value<int?>? clockOffsetMs,
    Value<DateTime?>? clockOffsetUpdatedAt,
    Value<DateTime?>? lastSyncAt,
    Value<String?>? enrolledSectionIdsJson,
    Value<String?>? profileJson,
    Value<String?>? activeProfileUserId,
    Value<int>? rowid,
  }) {
    return CachedMetaCompanion(
      userId: userId ?? this.userId,
      clockOffsetMs: clockOffsetMs ?? this.clockOffsetMs,
      clockOffsetUpdatedAt: clockOffsetUpdatedAt ?? this.clockOffsetUpdatedAt,
      lastSyncAt: lastSyncAt ?? this.lastSyncAt,
      enrolledSectionIdsJson:
          enrolledSectionIdsJson ?? this.enrolledSectionIdsJson,
      profileJson: profileJson ?? this.profileJson,
      activeProfileUserId: activeProfileUserId ?? this.activeProfileUserId,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (userId.present) {
      map['user_id'] = Variable<String>(userId.value);
    }
    if (clockOffsetMs.present) {
      map['clock_offset_ms'] = Variable<int>(clockOffsetMs.value);
    }
    if (clockOffsetUpdatedAt.present) {
      map['clock_offset_updated_at'] = Variable<DateTime>(
        clockOffsetUpdatedAt.value,
      );
    }
    if (lastSyncAt.present) {
      map['last_sync_at'] = Variable<DateTime>(lastSyncAt.value);
    }
    if (enrolledSectionIdsJson.present) {
      map['enrolled_section_ids_json'] = Variable<String>(
        enrolledSectionIdsJson.value,
      );
    }
    if (profileJson.present) {
      map['profile_json'] = Variable<String>(profileJson.value);
    }
    if (activeProfileUserId.present) {
      map['active_profile_user_id'] = Variable<String>(
        activeProfileUserId.value,
      );
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('CachedMetaCompanion(')
          ..write('userId: $userId, ')
          ..write('clockOffsetMs: $clockOffsetMs, ')
          ..write('clockOffsetUpdatedAt: $clockOffsetUpdatedAt, ')
          ..write('lastSyncAt: $lastSyncAt, ')
          ..write('enrolledSectionIdsJson: $enrolledSectionIdsJson, ')
          ..write('profileJson: $profileJson, ')
          ..write('activeProfileUserId: $activeProfileUserId, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

abstract class _$AppDatabase extends GeneratedDatabase {
  _$AppDatabase(QueryExecutor e) : super(e);
  $AppDatabaseManager get managers => $AppDatabaseManager(this);
  late final $CachedSubjectsTable cachedSubjects = $CachedSubjectsTable(this);
  late final $CachedSectionsTable cachedSections = $CachedSectionsTable(this);
  late final $CachedSchedulesTable cachedSchedules = $CachedSchedulesTable(
    this,
  );
  late final $CachedSessionsTable cachedSessions = $CachedSessionsTable(this);
  late final $CachedRostersTable cachedRosters = $CachedRostersTable(this);
  late final $CachedAttendanceTable cachedAttendance = $CachedAttendanceTable(
    this,
  );
  late final $OfflineAttendanceQueueTable offlineAttendanceQueue =
      $OfflineAttendanceQueueTable(this);
  late final $SystemReportQueueTable systemReportQueue =
      $SystemReportQueueTable(this);
  late final $ExcuseQueueTable excuseQueue = $ExcuseQueueTable(this);
  late final $NotificationsInboxTable notificationsInbox =
      $NotificationsInboxTable(this);
  late final $CachedMetaTable cachedMeta = $CachedMetaTable(this);
  late final Index cachedSectionsSubject = Index(
    'cached_sections_subject',
    'CREATE INDEX cached_sections_subject ON cached_sections (subject_id)',
  );
  late final Index cachedSessionsSection = Index(
    'cached_sessions_section',
    'CREATE INDEX cached_sessions_section ON cached_sessions (section_id)',
  );
  late final Index cachedRostersSection = Index(
    'cached_rosters_section',
    'CREATE INDEX cached_rosters_section ON cached_rosters (section_id)',
  );
  late final Index cachedAttendanceStudent = Index(
    'cached_attendance_student',
    'CREATE INDEX cached_attendance_student ON cached_attendance (student_id)',
  );
  late final Index cachedAttendanceSection = Index(
    'cached_attendance_section',
    'CREATE INDEX cached_attendance_section ON cached_attendance (section_id)',
  );
  late final Index cachedAttendanceSession = Index(
    'cached_attendance_session',
    'CREATE INDEX cached_attendance_session ON cached_attendance (session_id)',
  );
  late final Index offlineAttendanceSessionStudent = Index(
    'offline_attendance_session_student',
    'CREATE INDEX offline_attendance_session_student ON offline_attendance_queue (session_id, student_id)',
  );
  late final Index offlineAttendanceSyncStatus = Index(
    'offline_attendance_sync_status',
    'CREATE INDEX offline_attendance_sync_status ON offline_attendance_queue (sync_status)',
  );
  late final Index notificationsCreatedAt = Index(
    'notifications_created_at',
    'CREATE INDEX notifications_created_at ON notifications_inbox (created_at)',
  );
  @override
  Iterable<TableInfo<Table, Object?>> get allTables =>
      allSchemaEntities.whereType<TableInfo<Table, Object?>>();
  @override
  List<DatabaseSchemaEntity> get allSchemaEntities => [
    cachedSubjects,
    cachedSections,
    cachedSchedules,
    cachedSessions,
    cachedRosters,
    cachedAttendance,
    offlineAttendanceQueue,
    systemReportQueue,
    excuseQueue,
    notificationsInbox,
    cachedMeta,
    cachedSectionsSubject,
    cachedSessionsSection,
    cachedRostersSection,
    cachedAttendanceStudent,
    cachedAttendanceSection,
    cachedAttendanceSession,
    offlineAttendanceSessionStudent,
    offlineAttendanceSyncStatus,
    notificationsCreatedAt,
  ];
  @override
  DriftDatabaseOptions get options =>
      const DriftDatabaseOptions(storeDateTimeAsText: true);
}

typedef $$CachedSubjectsTableCreateCompanionBuilder =
    CachedSubjectsCompanion Function({
      required String userId,
      required String id,
      required String payloadJson,
      required DateTime cachedAt,
      Value<int> rowid,
    });
typedef $$CachedSubjectsTableUpdateCompanionBuilder =
    CachedSubjectsCompanion Function({
      Value<String> userId,
      Value<String> id,
      Value<String> payloadJson,
      Value<DateTime> cachedAt,
      Value<int> rowid,
    });

class $$CachedSubjectsTableFilterComposer
    extends Composer<_$AppDatabase, $CachedSubjectsTable> {
  $$CachedSubjectsTableFilterComposer({
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

  ColumnFilters<String> get id => $composableBuilder(
    column: $table.id,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get payloadJson => $composableBuilder(
    column: $table.payloadJson,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<DateTime> get cachedAt => $composableBuilder(
    column: $table.cachedAt,
    builder: (column) => ColumnFilters(column),
  );
}

class $$CachedSubjectsTableOrderingComposer
    extends Composer<_$AppDatabase, $CachedSubjectsTable> {
  $$CachedSubjectsTableOrderingComposer({
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

  ColumnOrderings<String> get id => $composableBuilder(
    column: $table.id,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get payloadJson => $composableBuilder(
    column: $table.payloadJson,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<DateTime> get cachedAt => $composableBuilder(
    column: $table.cachedAt,
    builder: (column) => ColumnOrderings(column),
  );
}

class $$CachedSubjectsTableAnnotationComposer
    extends Composer<_$AppDatabase, $CachedSubjectsTable> {
  $$CachedSubjectsTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get userId =>
      $composableBuilder(column: $table.userId, builder: (column) => column);

  GeneratedColumn<String> get id =>
      $composableBuilder(column: $table.id, builder: (column) => column);

  GeneratedColumn<String> get payloadJson => $composableBuilder(
    column: $table.payloadJson,
    builder: (column) => column,
  );

  GeneratedColumn<DateTime> get cachedAt =>
      $composableBuilder(column: $table.cachedAt, builder: (column) => column);
}

class $$CachedSubjectsTableTableManager
    extends
        RootTableManager<
          _$AppDatabase,
          $CachedSubjectsTable,
          CachedSubjectRow,
          $$CachedSubjectsTableFilterComposer,
          $$CachedSubjectsTableOrderingComposer,
          $$CachedSubjectsTableAnnotationComposer,
          $$CachedSubjectsTableCreateCompanionBuilder,
          $$CachedSubjectsTableUpdateCompanionBuilder,
          (
            CachedSubjectRow,
            BaseReferences<
              _$AppDatabase,
              $CachedSubjectsTable,
              CachedSubjectRow
            >,
          ),
          CachedSubjectRow,
          PrefetchHooks Function()
        > {
  $$CachedSubjectsTableTableManager(
    _$AppDatabase db,
    $CachedSubjectsTable table,
  ) : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$CachedSubjectsTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$CachedSubjectsTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$CachedSubjectsTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback:
              ({
                Value<String> userId = const Value.absent(),
                Value<String> id = const Value.absent(),
                Value<String> payloadJson = const Value.absent(),
                Value<DateTime> cachedAt = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => CachedSubjectsCompanion(
                userId: userId,
                id: id,
                payloadJson: payloadJson,
                cachedAt: cachedAt,
                rowid: rowid,
              ),
          createCompanionCallback:
              ({
                required String userId,
                required String id,
                required String payloadJson,
                required DateTime cachedAt,
                Value<int> rowid = const Value.absent(),
              }) => CachedSubjectsCompanion.insert(
                userId: userId,
                id: id,
                payloadJson: payloadJson,
                cachedAt: cachedAt,
                rowid: rowid,
              ),
          withReferenceMapper: (p0) => p0
              .map(
                (e) => (
                  e.readTable<$CachedSubjectsTable, CachedSubjectRow>(table),
                  BaseReferences<
                    _$AppDatabase,
                    $CachedSubjectsTable,
                    CachedSubjectRow
                  >(db, table, e),
                ),
              )
              .toList(),
          prefetchHooksCallback: null,
        ),
      );
}

typedef $$CachedSubjectsTableProcessedTableManager =
    ProcessedTableManager<
      _$AppDatabase,
      $CachedSubjectsTable,
      CachedSubjectRow,
      $$CachedSubjectsTableFilterComposer,
      $$CachedSubjectsTableOrderingComposer,
      $$CachedSubjectsTableAnnotationComposer,
      $$CachedSubjectsTableCreateCompanionBuilder,
      $$CachedSubjectsTableUpdateCompanionBuilder,
      (
        CachedSubjectRow,
        BaseReferences<_$AppDatabase, $CachedSubjectsTable, CachedSubjectRow>,
      ),
      CachedSubjectRow,
      PrefetchHooks Function()
    >;
typedef $$CachedSectionsTableCreateCompanionBuilder =
    CachedSectionsCompanion Function({
      required String userId,
      required String id,
      required String subjectId,
      required String payloadJson,
      required DateTime cachedAt,
      Value<int> rowid,
    });
typedef $$CachedSectionsTableUpdateCompanionBuilder =
    CachedSectionsCompanion Function({
      Value<String> userId,
      Value<String> id,
      Value<String> subjectId,
      Value<String> payloadJson,
      Value<DateTime> cachedAt,
      Value<int> rowid,
    });

class $$CachedSectionsTableFilterComposer
    extends Composer<_$AppDatabase, $CachedSectionsTable> {
  $$CachedSectionsTableFilterComposer({
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

  ColumnFilters<String> get id => $composableBuilder(
    column: $table.id,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get subjectId => $composableBuilder(
    column: $table.subjectId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get payloadJson => $composableBuilder(
    column: $table.payloadJson,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<DateTime> get cachedAt => $composableBuilder(
    column: $table.cachedAt,
    builder: (column) => ColumnFilters(column),
  );
}

class $$CachedSectionsTableOrderingComposer
    extends Composer<_$AppDatabase, $CachedSectionsTable> {
  $$CachedSectionsTableOrderingComposer({
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

  ColumnOrderings<String> get id => $composableBuilder(
    column: $table.id,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get subjectId => $composableBuilder(
    column: $table.subjectId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get payloadJson => $composableBuilder(
    column: $table.payloadJson,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<DateTime> get cachedAt => $composableBuilder(
    column: $table.cachedAt,
    builder: (column) => ColumnOrderings(column),
  );
}

class $$CachedSectionsTableAnnotationComposer
    extends Composer<_$AppDatabase, $CachedSectionsTable> {
  $$CachedSectionsTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get userId =>
      $composableBuilder(column: $table.userId, builder: (column) => column);

  GeneratedColumn<String> get id =>
      $composableBuilder(column: $table.id, builder: (column) => column);

  GeneratedColumn<String> get subjectId =>
      $composableBuilder(column: $table.subjectId, builder: (column) => column);

  GeneratedColumn<String> get payloadJson => $composableBuilder(
    column: $table.payloadJson,
    builder: (column) => column,
  );

  GeneratedColumn<DateTime> get cachedAt =>
      $composableBuilder(column: $table.cachedAt, builder: (column) => column);
}

class $$CachedSectionsTableTableManager
    extends
        RootTableManager<
          _$AppDatabase,
          $CachedSectionsTable,
          CachedSectionRow,
          $$CachedSectionsTableFilterComposer,
          $$CachedSectionsTableOrderingComposer,
          $$CachedSectionsTableAnnotationComposer,
          $$CachedSectionsTableCreateCompanionBuilder,
          $$CachedSectionsTableUpdateCompanionBuilder,
          (
            CachedSectionRow,
            BaseReferences<
              _$AppDatabase,
              $CachedSectionsTable,
              CachedSectionRow
            >,
          ),
          CachedSectionRow,
          PrefetchHooks Function()
        > {
  $$CachedSectionsTableTableManager(
    _$AppDatabase db,
    $CachedSectionsTable table,
  ) : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$CachedSectionsTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$CachedSectionsTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$CachedSectionsTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback:
              ({
                Value<String> userId = const Value.absent(),
                Value<String> id = const Value.absent(),
                Value<String> subjectId = const Value.absent(),
                Value<String> payloadJson = const Value.absent(),
                Value<DateTime> cachedAt = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => CachedSectionsCompanion(
                userId: userId,
                id: id,
                subjectId: subjectId,
                payloadJson: payloadJson,
                cachedAt: cachedAt,
                rowid: rowid,
              ),
          createCompanionCallback:
              ({
                required String userId,
                required String id,
                required String subjectId,
                required String payloadJson,
                required DateTime cachedAt,
                Value<int> rowid = const Value.absent(),
              }) => CachedSectionsCompanion.insert(
                userId: userId,
                id: id,
                subjectId: subjectId,
                payloadJson: payloadJson,
                cachedAt: cachedAt,
                rowid: rowid,
              ),
          withReferenceMapper: (p0) => p0
              .map(
                (e) => (
                  e.readTable<$CachedSectionsTable, CachedSectionRow>(table),
                  BaseReferences<
                    _$AppDatabase,
                    $CachedSectionsTable,
                    CachedSectionRow
                  >(db, table, e),
                ),
              )
              .toList(),
          prefetchHooksCallback: null,
        ),
      );
}

typedef $$CachedSectionsTableProcessedTableManager =
    ProcessedTableManager<
      _$AppDatabase,
      $CachedSectionsTable,
      CachedSectionRow,
      $$CachedSectionsTableFilterComposer,
      $$CachedSectionsTableOrderingComposer,
      $$CachedSectionsTableAnnotationComposer,
      $$CachedSectionsTableCreateCompanionBuilder,
      $$CachedSectionsTableUpdateCompanionBuilder,
      (
        CachedSectionRow,
        BaseReferences<_$AppDatabase, $CachedSectionsTable, CachedSectionRow>,
      ),
      CachedSectionRow,
      PrefetchHooks Function()
    >;
typedef $$CachedSchedulesTableCreateCompanionBuilder =
    CachedSchedulesCompanion Function({
      required String userId,
      required String rangeKey,
      required String payloadJson,
      required DateTime cachedAt,
      Value<int> rowid,
    });
typedef $$CachedSchedulesTableUpdateCompanionBuilder =
    CachedSchedulesCompanion Function({
      Value<String> userId,
      Value<String> rangeKey,
      Value<String> payloadJson,
      Value<DateTime> cachedAt,
      Value<int> rowid,
    });

class $$CachedSchedulesTableFilterComposer
    extends Composer<_$AppDatabase, $CachedSchedulesTable> {
  $$CachedSchedulesTableFilterComposer({
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

  ColumnFilters<String> get rangeKey => $composableBuilder(
    column: $table.rangeKey,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get payloadJson => $composableBuilder(
    column: $table.payloadJson,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<DateTime> get cachedAt => $composableBuilder(
    column: $table.cachedAt,
    builder: (column) => ColumnFilters(column),
  );
}

class $$CachedSchedulesTableOrderingComposer
    extends Composer<_$AppDatabase, $CachedSchedulesTable> {
  $$CachedSchedulesTableOrderingComposer({
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

  ColumnOrderings<String> get rangeKey => $composableBuilder(
    column: $table.rangeKey,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get payloadJson => $composableBuilder(
    column: $table.payloadJson,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<DateTime> get cachedAt => $composableBuilder(
    column: $table.cachedAt,
    builder: (column) => ColumnOrderings(column),
  );
}

class $$CachedSchedulesTableAnnotationComposer
    extends Composer<_$AppDatabase, $CachedSchedulesTable> {
  $$CachedSchedulesTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get userId =>
      $composableBuilder(column: $table.userId, builder: (column) => column);

  GeneratedColumn<String> get rangeKey =>
      $composableBuilder(column: $table.rangeKey, builder: (column) => column);

  GeneratedColumn<String> get payloadJson => $composableBuilder(
    column: $table.payloadJson,
    builder: (column) => column,
  );

  GeneratedColumn<DateTime> get cachedAt =>
      $composableBuilder(column: $table.cachedAt, builder: (column) => column);
}

class $$CachedSchedulesTableTableManager
    extends
        RootTableManager<
          _$AppDatabase,
          $CachedSchedulesTable,
          CachedScheduleRow,
          $$CachedSchedulesTableFilterComposer,
          $$CachedSchedulesTableOrderingComposer,
          $$CachedSchedulesTableAnnotationComposer,
          $$CachedSchedulesTableCreateCompanionBuilder,
          $$CachedSchedulesTableUpdateCompanionBuilder,
          (
            CachedScheduleRow,
            BaseReferences<
              _$AppDatabase,
              $CachedSchedulesTable,
              CachedScheduleRow
            >,
          ),
          CachedScheduleRow,
          PrefetchHooks Function()
        > {
  $$CachedSchedulesTableTableManager(
    _$AppDatabase db,
    $CachedSchedulesTable table,
  ) : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$CachedSchedulesTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$CachedSchedulesTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$CachedSchedulesTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback:
              ({
                Value<String> userId = const Value.absent(),
                Value<String> rangeKey = const Value.absent(),
                Value<String> payloadJson = const Value.absent(),
                Value<DateTime> cachedAt = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => CachedSchedulesCompanion(
                userId: userId,
                rangeKey: rangeKey,
                payloadJson: payloadJson,
                cachedAt: cachedAt,
                rowid: rowid,
              ),
          createCompanionCallback:
              ({
                required String userId,
                required String rangeKey,
                required String payloadJson,
                required DateTime cachedAt,
                Value<int> rowid = const Value.absent(),
              }) => CachedSchedulesCompanion.insert(
                userId: userId,
                rangeKey: rangeKey,
                payloadJson: payloadJson,
                cachedAt: cachedAt,
                rowid: rowid,
              ),
          withReferenceMapper: (p0) => p0
              .map(
                (e) => (
                  e.readTable<$CachedSchedulesTable, CachedScheduleRow>(table),
                  BaseReferences<
                    _$AppDatabase,
                    $CachedSchedulesTable,
                    CachedScheduleRow
                  >(db, table, e),
                ),
              )
              .toList(),
          prefetchHooksCallback: null,
        ),
      );
}

typedef $$CachedSchedulesTableProcessedTableManager =
    ProcessedTableManager<
      _$AppDatabase,
      $CachedSchedulesTable,
      CachedScheduleRow,
      $$CachedSchedulesTableFilterComposer,
      $$CachedSchedulesTableOrderingComposer,
      $$CachedSchedulesTableAnnotationComposer,
      $$CachedSchedulesTableCreateCompanionBuilder,
      $$CachedSchedulesTableUpdateCompanionBuilder,
      (
        CachedScheduleRow,
        BaseReferences<_$AppDatabase, $CachedSchedulesTable, CachedScheduleRow>,
      ),
      CachedScheduleRow,
      PrefetchHooks Function()
    >;
typedef $$CachedSessionsTableCreateCompanionBuilder =
    CachedSessionsCompanion Function({
      required String userId,
      required String id,
      required String sectionId,
      required String payloadJson,
      required DateTime cachedAt,
      Value<int> rowid,
    });
typedef $$CachedSessionsTableUpdateCompanionBuilder =
    CachedSessionsCompanion Function({
      Value<String> userId,
      Value<String> id,
      Value<String> sectionId,
      Value<String> payloadJson,
      Value<DateTime> cachedAt,
      Value<int> rowid,
    });

class $$CachedSessionsTableFilterComposer
    extends Composer<_$AppDatabase, $CachedSessionsTable> {
  $$CachedSessionsTableFilterComposer({
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

  ColumnFilters<String> get id => $composableBuilder(
    column: $table.id,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get sectionId => $composableBuilder(
    column: $table.sectionId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get payloadJson => $composableBuilder(
    column: $table.payloadJson,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<DateTime> get cachedAt => $composableBuilder(
    column: $table.cachedAt,
    builder: (column) => ColumnFilters(column),
  );
}

class $$CachedSessionsTableOrderingComposer
    extends Composer<_$AppDatabase, $CachedSessionsTable> {
  $$CachedSessionsTableOrderingComposer({
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

  ColumnOrderings<String> get id => $composableBuilder(
    column: $table.id,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get sectionId => $composableBuilder(
    column: $table.sectionId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get payloadJson => $composableBuilder(
    column: $table.payloadJson,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<DateTime> get cachedAt => $composableBuilder(
    column: $table.cachedAt,
    builder: (column) => ColumnOrderings(column),
  );
}

class $$CachedSessionsTableAnnotationComposer
    extends Composer<_$AppDatabase, $CachedSessionsTable> {
  $$CachedSessionsTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get userId =>
      $composableBuilder(column: $table.userId, builder: (column) => column);

  GeneratedColumn<String> get id =>
      $composableBuilder(column: $table.id, builder: (column) => column);

  GeneratedColumn<String> get sectionId =>
      $composableBuilder(column: $table.sectionId, builder: (column) => column);

  GeneratedColumn<String> get payloadJson => $composableBuilder(
    column: $table.payloadJson,
    builder: (column) => column,
  );

  GeneratedColumn<DateTime> get cachedAt =>
      $composableBuilder(column: $table.cachedAt, builder: (column) => column);
}

class $$CachedSessionsTableTableManager
    extends
        RootTableManager<
          _$AppDatabase,
          $CachedSessionsTable,
          CachedSessionRow,
          $$CachedSessionsTableFilterComposer,
          $$CachedSessionsTableOrderingComposer,
          $$CachedSessionsTableAnnotationComposer,
          $$CachedSessionsTableCreateCompanionBuilder,
          $$CachedSessionsTableUpdateCompanionBuilder,
          (
            CachedSessionRow,
            BaseReferences<
              _$AppDatabase,
              $CachedSessionsTable,
              CachedSessionRow
            >,
          ),
          CachedSessionRow,
          PrefetchHooks Function()
        > {
  $$CachedSessionsTableTableManager(
    _$AppDatabase db,
    $CachedSessionsTable table,
  ) : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$CachedSessionsTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$CachedSessionsTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$CachedSessionsTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback:
              ({
                Value<String> userId = const Value.absent(),
                Value<String> id = const Value.absent(),
                Value<String> sectionId = const Value.absent(),
                Value<String> payloadJson = const Value.absent(),
                Value<DateTime> cachedAt = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => CachedSessionsCompanion(
                userId: userId,
                id: id,
                sectionId: sectionId,
                payloadJson: payloadJson,
                cachedAt: cachedAt,
                rowid: rowid,
              ),
          createCompanionCallback:
              ({
                required String userId,
                required String id,
                required String sectionId,
                required String payloadJson,
                required DateTime cachedAt,
                Value<int> rowid = const Value.absent(),
              }) => CachedSessionsCompanion.insert(
                userId: userId,
                id: id,
                sectionId: sectionId,
                payloadJson: payloadJson,
                cachedAt: cachedAt,
                rowid: rowid,
              ),
          withReferenceMapper: (p0) => p0
              .map(
                (e) => (
                  e.readTable<$CachedSessionsTable, CachedSessionRow>(table),
                  BaseReferences<
                    _$AppDatabase,
                    $CachedSessionsTable,
                    CachedSessionRow
                  >(db, table, e),
                ),
              )
              .toList(),
          prefetchHooksCallback: null,
        ),
      );
}

typedef $$CachedSessionsTableProcessedTableManager =
    ProcessedTableManager<
      _$AppDatabase,
      $CachedSessionsTable,
      CachedSessionRow,
      $$CachedSessionsTableFilterComposer,
      $$CachedSessionsTableOrderingComposer,
      $$CachedSessionsTableAnnotationComposer,
      $$CachedSessionsTableCreateCompanionBuilder,
      $$CachedSessionsTableUpdateCompanionBuilder,
      (
        CachedSessionRow,
        BaseReferences<_$AppDatabase, $CachedSessionsTable, CachedSessionRow>,
      ),
      CachedSessionRow,
      PrefetchHooks Function()
    >;
typedef $$CachedRostersTableCreateCompanionBuilder =
    CachedRostersCompanion Function({
      required String userId,
      required String sectionId,
      required String studentId,
      required String payloadJson,
      required DateTime cachedAt,
      Value<int> rowid,
    });
typedef $$CachedRostersTableUpdateCompanionBuilder =
    CachedRostersCompanion Function({
      Value<String> userId,
      Value<String> sectionId,
      Value<String> studentId,
      Value<String> payloadJson,
      Value<DateTime> cachedAt,
      Value<int> rowid,
    });

class $$CachedRostersTableFilterComposer
    extends Composer<_$AppDatabase, $CachedRostersTable> {
  $$CachedRostersTableFilterComposer({
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

  ColumnFilters<String> get sectionId => $composableBuilder(
    column: $table.sectionId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get studentId => $composableBuilder(
    column: $table.studentId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get payloadJson => $composableBuilder(
    column: $table.payloadJson,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<DateTime> get cachedAt => $composableBuilder(
    column: $table.cachedAt,
    builder: (column) => ColumnFilters(column),
  );
}

class $$CachedRostersTableOrderingComposer
    extends Composer<_$AppDatabase, $CachedRostersTable> {
  $$CachedRostersTableOrderingComposer({
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

  ColumnOrderings<String> get sectionId => $composableBuilder(
    column: $table.sectionId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get studentId => $composableBuilder(
    column: $table.studentId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get payloadJson => $composableBuilder(
    column: $table.payloadJson,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<DateTime> get cachedAt => $composableBuilder(
    column: $table.cachedAt,
    builder: (column) => ColumnOrderings(column),
  );
}

class $$CachedRostersTableAnnotationComposer
    extends Composer<_$AppDatabase, $CachedRostersTable> {
  $$CachedRostersTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get userId =>
      $composableBuilder(column: $table.userId, builder: (column) => column);

  GeneratedColumn<String> get sectionId =>
      $composableBuilder(column: $table.sectionId, builder: (column) => column);

  GeneratedColumn<String> get studentId =>
      $composableBuilder(column: $table.studentId, builder: (column) => column);

  GeneratedColumn<String> get payloadJson => $composableBuilder(
    column: $table.payloadJson,
    builder: (column) => column,
  );

  GeneratedColumn<DateTime> get cachedAt =>
      $composableBuilder(column: $table.cachedAt, builder: (column) => column);
}

class $$CachedRostersTableTableManager
    extends
        RootTableManager<
          _$AppDatabase,
          $CachedRostersTable,
          CachedRosterRow,
          $$CachedRostersTableFilterComposer,
          $$CachedRostersTableOrderingComposer,
          $$CachedRostersTableAnnotationComposer,
          $$CachedRostersTableCreateCompanionBuilder,
          $$CachedRostersTableUpdateCompanionBuilder,
          (
            CachedRosterRow,
            BaseReferences<_$AppDatabase, $CachedRostersTable, CachedRosterRow>,
          ),
          CachedRosterRow,
          PrefetchHooks Function()
        > {
  $$CachedRostersTableTableManager(_$AppDatabase db, $CachedRostersTable table)
    : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$CachedRostersTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$CachedRostersTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$CachedRostersTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback:
              ({
                Value<String> userId = const Value.absent(),
                Value<String> sectionId = const Value.absent(),
                Value<String> studentId = const Value.absent(),
                Value<String> payloadJson = const Value.absent(),
                Value<DateTime> cachedAt = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => CachedRostersCompanion(
                userId: userId,
                sectionId: sectionId,
                studentId: studentId,
                payloadJson: payloadJson,
                cachedAt: cachedAt,
                rowid: rowid,
              ),
          createCompanionCallback:
              ({
                required String userId,
                required String sectionId,
                required String studentId,
                required String payloadJson,
                required DateTime cachedAt,
                Value<int> rowid = const Value.absent(),
              }) => CachedRostersCompanion.insert(
                userId: userId,
                sectionId: sectionId,
                studentId: studentId,
                payloadJson: payloadJson,
                cachedAt: cachedAt,
                rowid: rowid,
              ),
          withReferenceMapper: (p0) => p0
              .map(
                (e) => (
                  e.readTable<$CachedRostersTable, CachedRosterRow>(table),
                  BaseReferences<
                    _$AppDatabase,
                    $CachedRostersTable,
                    CachedRosterRow
                  >(db, table, e),
                ),
              )
              .toList(),
          prefetchHooksCallback: null,
        ),
      );
}

typedef $$CachedRostersTableProcessedTableManager =
    ProcessedTableManager<
      _$AppDatabase,
      $CachedRostersTable,
      CachedRosterRow,
      $$CachedRostersTableFilterComposer,
      $$CachedRostersTableOrderingComposer,
      $$CachedRostersTableAnnotationComposer,
      $$CachedRostersTableCreateCompanionBuilder,
      $$CachedRostersTableUpdateCompanionBuilder,
      (
        CachedRosterRow,
        BaseReferences<_$AppDatabase, $CachedRostersTable, CachedRosterRow>,
      ),
      CachedRosterRow,
      PrefetchHooks Function()
    >;
typedef $$CachedAttendanceTableCreateCompanionBuilder =
    CachedAttendanceCompanion Function({
      required String userId,
      required String id,
      required String studentId,
      required String sectionId,
      required String sessionId,
      Value<bool> isSynced,
      required String payloadJson,
      required DateTime cachedAt,
      Value<int> rowid,
    });
typedef $$CachedAttendanceTableUpdateCompanionBuilder =
    CachedAttendanceCompanion Function({
      Value<String> userId,
      Value<String> id,
      Value<String> studentId,
      Value<String> sectionId,
      Value<String> sessionId,
      Value<bool> isSynced,
      Value<String> payloadJson,
      Value<DateTime> cachedAt,
      Value<int> rowid,
    });

class $$CachedAttendanceTableFilterComposer
    extends Composer<_$AppDatabase, $CachedAttendanceTable> {
  $$CachedAttendanceTableFilterComposer({
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

  ColumnFilters<String> get id => $composableBuilder(
    column: $table.id,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get studentId => $composableBuilder(
    column: $table.studentId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get sectionId => $composableBuilder(
    column: $table.sectionId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get sessionId => $composableBuilder(
    column: $table.sessionId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<bool> get isSynced => $composableBuilder(
    column: $table.isSynced,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get payloadJson => $composableBuilder(
    column: $table.payloadJson,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<DateTime> get cachedAt => $composableBuilder(
    column: $table.cachedAt,
    builder: (column) => ColumnFilters(column),
  );
}

class $$CachedAttendanceTableOrderingComposer
    extends Composer<_$AppDatabase, $CachedAttendanceTable> {
  $$CachedAttendanceTableOrderingComposer({
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

  ColumnOrderings<String> get id => $composableBuilder(
    column: $table.id,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get studentId => $composableBuilder(
    column: $table.studentId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get sectionId => $composableBuilder(
    column: $table.sectionId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get sessionId => $composableBuilder(
    column: $table.sessionId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<bool> get isSynced => $composableBuilder(
    column: $table.isSynced,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get payloadJson => $composableBuilder(
    column: $table.payloadJson,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<DateTime> get cachedAt => $composableBuilder(
    column: $table.cachedAt,
    builder: (column) => ColumnOrderings(column),
  );
}

class $$CachedAttendanceTableAnnotationComposer
    extends Composer<_$AppDatabase, $CachedAttendanceTable> {
  $$CachedAttendanceTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get userId =>
      $composableBuilder(column: $table.userId, builder: (column) => column);

  GeneratedColumn<String> get id =>
      $composableBuilder(column: $table.id, builder: (column) => column);

  GeneratedColumn<String> get studentId =>
      $composableBuilder(column: $table.studentId, builder: (column) => column);

  GeneratedColumn<String> get sectionId =>
      $composableBuilder(column: $table.sectionId, builder: (column) => column);

  GeneratedColumn<String> get sessionId =>
      $composableBuilder(column: $table.sessionId, builder: (column) => column);

  GeneratedColumn<bool> get isSynced =>
      $composableBuilder(column: $table.isSynced, builder: (column) => column);

  GeneratedColumn<String> get payloadJson => $composableBuilder(
    column: $table.payloadJson,
    builder: (column) => column,
  );

  GeneratedColumn<DateTime> get cachedAt =>
      $composableBuilder(column: $table.cachedAt, builder: (column) => column);
}

class $$CachedAttendanceTableTableManager
    extends
        RootTableManager<
          _$AppDatabase,
          $CachedAttendanceTable,
          CachedAttendanceRow,
          $$CachedAttendanceTableFilterComposer,
          $$CachedAttendanceTableOrderingComposer,
          $$CachedAttendanceTableAnnotationComposer,
          $$CachedAttendanceTableCreateCompanionBuilder,
          $$CachedAttendanceTableUpdateCompanionBuilder,
          (
            CachedAttendanceRow,
            BaseReferences<
              _$AppDatabase,
              $CachedAttendanceTable,
              CachedAttendanceRow
            >,
          ),
          CachedAttendanceRow,
          PrefetchHooks Function()
        > {
  $$CachedAttendanceTableTableManager(
    _$AppDatabase db,
    $CachedAttendanceTable table,
  ) : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$CachedAttendanceTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$CachedAttendanceTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$CachedAttendanceTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback:
              ({
                Value<String> userId = const Value.absent(),
                Value<String> id = const Value.absent(),
                Value<String> studentId = const Value.absent(),
                Value<String> sectionId = const Value.absent(),
                Value<String> sessionId = const Value.absent(),
                Value<bool> isSynced = const Value.absent(),
                Value<String> payloadJson = const Value.absent(),
                Value<DateTime> cachedAt = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => CachedAttendanceCompanion(
                userId: userId,
                id: id,
                studentId: studentId,
                sectionId: sectionId,
                sessionId: sessionId,
                isSynced: isSynced,
                payloadJson: payloadJson,
                cachedAt: cachedAt,
                rowid: rowid,
              ),
          createCompanionCallback:
              ({
                required String userId,
                required String id,
                required String studentId,
                required String sectionId,
                required String sessionId,
                Value<bool> isSynced = const Value.absent(),
                required String payloadJson,
                required DateTime cachedAt,
                Value<int> rowid = const Value.absent(),
              }) => CachedAttendanceCompanion.insert(
                userId: userId,
                id: id,
                studentId: studentId,
                sectionId: sectionId,
                sessionId: sessionId,
                isSynced: isSynced,
                payloadJson: payloadJson,
                cachedAt: cachedAt,
                rowid: rowid,
              ),
          withReferenceMapper: (p0) => p0
              .map(
                (e) => (
                  e.readTable<$CachedAttendanceTable, CachedAttendanceRow>(
                    table,
                  ),
                  BaseReferences<
                    _$AppDatabase,
                    $CachedAttendanceTable,
                    CachedAttendanceRow
                  >(db, table, e),
                ),
              )
              .toList(),
          prefetchHooksCallback: null,
        ),
      );
}

typedef $$CachedAttendanceTableProcessedTableManager =
    ProcessedTableManager<
      _$AppDatabase,
      $CachedAttendanceTable,
      CachedAttendanceRow,
      $$CachedAttendanceTableFilterComposer,
      $$CachedAttendanceTableOrderingComposer,
      $$CachedAttendanceTableAnnotationComposer,
      $$CachedAttendanceTableCreateCompanionBuilder,
      $$CachedAttendanceTableUpdateCompanionBuilder,
      (
        CachedAttendanceRow,
        BaseReferences<
          _$AppDatabase,
          $CachedAttendanceTable,
          CachedAttendanceRow
        >,
      ),
      CachedAttendanceRow,
      PrefetchHooks Function()
    >;
typedef $$OfflineAttendanceQueueTableCreateCompanionBuilder =
    OfflineAttendanceQueueCompanion Function({
      required String clientReceiptId,
      required String userId,
      required String sessionId,
      required String studentId,
      required String scannedToken,
      Value<String?> checkpoint,
      Value<String?> pinHash,
      Value<String?> pinEncrypted,
      Value<double?> latitude,
      Value<double?> longitude,
      Value<double?> accuracy,
      Value<DateTime?> locationCapturedAt,
      Value<double?> haversineDistance,
      Value<bool> isMocked,
      Value<String?> inputChannel,
      required DateTime scannedAtUtc,
      required AttendanceSyncStatus syncStatus,
      Value<String?> serverError,
      Value<int> retryCount,
      Value<DateTime?> lastSentAt,
      required DateTime createdAt,
      Value<int> rowid,
    });
typedef $$OfflineAttendanceQueueTableUpdateCompanionBuilder =
    OfflineAttendanceQueueCompanion Function({
      Value<String> clientReceiptId,
      Value<String> userId,
      Value<String> sessionId,
      Value<String> studentId,
      Value<String> scannedToken,
      Value<String?> checkpoint,
      Value<String?> pinHash,
      Value<String?> pinEncrypted,
      Value<double?> latitude,
      Value<double?> longitude,
      Value<double?> accuracy,
      Value<DateTime?> locationCapturedAt,
      Value<double?> haversineDistance,
      Value<bool> isMocked,
      Value<String?> inputChannel,
      Value<DateTime> scannedAtUtc,
      Value<AttendanceSyncStatus> syncStatus,
      Value<String?> serverError,
      Value<int> retryCount,
      Value<DateTime?> lastSentAt,
      Value<DateTime> createdAt,
      Value<int> rowid,
    });

class $$OfflineAttendanceQueueTableFilterComposer
    extends Composer<_$AppDatabase, $OfflineAttendanceQueueTable> {
  $$OfflineAttendanceQueueTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get clientReceiptId => $composableBuilder(
    column: $table.clientReceiptId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get userId => $composableBuilder(
    column: $table.userId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get sessionId => $composableBuilder(
    column: $table.sessionId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get studentId => $composableBuilder(
    column: $table.studentId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get scannedToken => $composableBuilder(
    column: $table.scannedToken,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get checkpoint => $composableBuilder(
    column: $table.checkpoint,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get pinHash => $composableBuilder(
    column: $table.pinHash,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get pinEncrypted => $composableBuilder(
    column: $table.pinEncrypted,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<double> get latitude => $composableBuilder(
    column: $table.latitude,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<double> get longitude => $composableBuilder(
    column: $table.longitude,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<double> get accuracy => $composableBuilder(
    column: $table.accuracy,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<DateTime> get locationCapturedAt => $composableBuilder(
    column: $table.locationCapturedAt,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<double> get haversineDistance => $composableBuilder(
    column: $table.haversineDistance,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<bool> get isMocked => $composableBuilder(
    column: $table.isMocked,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get inputChannel => $composableBuilder(
    column: $table.inputChannel,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<DateTime> get scannedAtUtc => $composableBuilder(
    column: $table.scannedAtUtc,
    builder: (column) => ColumnFilters(column),
  );

  ColumnWithTypeConverterFilters<
    AttendanceSyncStatus,
    AttendanceSyncStatus,
    String
  >
  get syncStatus => $composableBuilder(
    column: $table.syncStatus,
    builder: (column) => ColumnWithTypeConverterFilters(column),
  );

  ColumnFilters<String> get serverError => $composableBuilder(
    column: $table.serverError,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get retryCount => $composableBuilder(
    column: $table.retryCount,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<DateTime> get lastSentAt => $composableBuilder(
    column: $table.lastSentAt,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<DateTime> get createdAt => $composableBuilder(
    column: $table.createdAt,
    builder: (column) => ColumnFilters(column),
  );
}

class $$OfflineAttendanceQueueTableOrderingComposer
    extends Composer<_$AppDatabase, $OfflineAttendanceQueueTable> {
  $$OfflineAttendanceQueueTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get clientReceiptId => $composableBuilder(
    column: $table.clientReceiptId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get userId => $composableBuilder(
    column: $table.userId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get sessionId => $composableBuilder(
    column: $table.sessionId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get studentId => $composableBuilder(
    column: $table.studentId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get scannedToken => $composableBuilder(
    column: $table.scannedToken,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get checkpoint => $composableBuilder(
    column: $table.checkpoint,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get pinHash => $composableBuilder(
    column: $table.pinHash,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get pinEncrypted => $composableBuilder(
    column: $table.pinEncrypted,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<double> get latitude => $composableBuilder(
    column: $table.latitude,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<double> get longitude => $composableBuilder(
    column: $table.longitude,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<double> get accuracy => $composableBuilder(
    column: $table.accuracy,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<DateTime> get locationCapturedAt => $composableBuilder(
    column: $table.locationCapturedAt,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<double> get haversineDistance => $composableBuilder(
    column: $table.haversineDistance,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<bool> get isMocked => $composableBuilder(
    column: $table.isMocked,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get inputChannel => $composableBuilder(
    column: $table.inputChannel,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<DateTime> get scannedAtUtc => $composableBuilder(
    column: $table.scannedAtUtc,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get syncStatus => $composableBuilder(
    column: $table.syncStatus,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get serverError => $composableBuilder(
    column: $table.serverError,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get retryCount => $composableBuilder(
    column: $table.retryCount,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<DateTime> get lastSentAt => $composableBuilder(
    column: $table.lastSentAt,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<DateTime> get createdAt => $composableBuilder(
    column: $table.createdAt,
    builder: (column) => ColumnOrderings(column),
  );
}

class $$OfflineAttendanceQueueTableAnnotationComposer
    extends Composer<_$AppDatabase, $OfflineAttendanceQueueTable> {
  $$OfflineAttendanceQueueTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get clientReceiptId => $composableBuilder(
    column: $table.clientReceiptId,
    builder: (column) => column,
  );

  GeneratedColumn<String> get userId =>
      $composableBuilder(column: $table.userId, builder: (column) => column);

  GeneratedColumn<String> get sessionId =>
      $composableBuilder(column: $table.sessionId, builder: (column) => column);

  GeneratedColumn<String> get studentId =>
      $composableBuilder(column: $table.studentId, builder: (column) => column);

  GeneratedColumn<String> get scannedToken => $composableBuilder(
    column: $table.scannedToken,
    builder: (column) => column,
  );

  GeneratedColumn<String> get checkpoint => $composableBuilder(
    column: $table.checkpoint,
    builder: (column) => column,
  );

  GeneratedColumn<String> get pinHash =>
      $composableBuilder(column: $table.pinHash, builder: (column) => column);

  GeneratedColumn<String> get pinEncrypted => $composableBuilder(
    column: $table.pinEncrypted,
    builder: (column) => column,
  );

  GeneratedColumn<double> get latitude =>
      $composableBuilder(column: $table.latitude, builder: (column) => column);

  GeneratedColumn<double> get longitude =>
      $composableBuilder(column: $table.longitude, builder: (column) => column);

  GeneratedColumn<double> get accuracy =>
      $composableBuilder(column: $table.accuracy, builder: (column) => column);

  GeneratedColumn<DateTime> get locationCapturedAt => $composableBuilder(
    column: $table.locationCapturedAt,
    builder: (column) => column,
  );

  GeneratedColumn<double> get haversineDistance => $composableBuilder(
    column: $table.haversineDistance,
    builder: (column) => column,
  );

  GeneratedColumn<bool> get isMocked =>
      $composableBuilder(column: $table.isMocked, builder: (column) => column);

  GeneratedColumn<String> get inputChannel => $composableBuilder(
    column: $table.inputChannel,
    builder: (column) => column,
  );

  GeneratedColumn<DateTime> get scannedAtUtc => $composableBuilder(
    column: $table.scannedAtUtc,
    builder: (column) => column,
  );

  GeneratedColumnWithTypeConverter<AttendanceSyncStatus, String>
  get syncStatus => $composableBuilder(
    column: $table.syncStatus,
    builder: (column) => column,
  );

  GeneratedColumn<String> get serverError => $composableBuilder(
    column: $table.serverError,
    builder: (column) => column,
  );

  GeneratedColumn<int> get retryCount => $composableBuilder(
    column: $table.retryCount,
    builder: (column) => column,
  );

  GeneratedColumn<DateTime> get lastSentAt => $composableBuilder(
    column: $table.lastSentAt,
    builder: (column) => column,
  );

  GeneratedColumn<DateTime> get createdAt =>
      $composableBuilder(column: $table.createdAt, builder: (column) => column);
}

class $$OfflineAttendanceQueueTableTableManager
    extends
        RootTableManager<
          _$AppDatabase,
          $OfflineAttendanceQueueTable,
          OfflineAttendanceQueueRow,
          $$OfflineAttendanceQueueTableFilterComposer,
          $$OfflineAttendanceQueueTableOrderingComposer,
          $$OfflineAttendanceQueueTableAnnotationComposer,
          $$OfflineAttendanceQueueTableCreateCompanionBuilder,
          $$OfflineAttendanceQueueTableUpdateCompanionBuilder,
          (
            OfflineAttendanceQueueRow,
            BaseReferences<
              _$AppDatabase,
              $OfflineAttendanceQueueTable,
              OfflineAttendanceQueueRow
            >,
          ),
          OfflineAttendanceQueueRow,
          PrefetchHooks Function()
        > {
  $$OfflineAttendanceQueueTableTableManager(
    _$AppDatabase db,
    $OfflineAttendanceQueueTable table,
  ) : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$OfflineAttendanceQueueTableFilterComposer(
                $db: db,
                $table: table,
              ),
          createOrderingComposer: () =>
              $$OfflineAttendanceQueueTableOrderingComposer(
                $db: db,
                $table: table,
              ),
          createComputedFieldComposer: () =>
              $$OfflineAttendanceQueueTableAnnotationComposer(
                $db: db,
                $table: table,
              ),
          updateCompanionCallback:
              ({
                Value<String> clientReceiptId = const Value.absent(),
                Value<String> userId = const Value.absent(),
                Value<String> sessionId = const Value.absent(),
                Value<String> studentId = const Value.absent(),
                Value<String> scannedToken = const Value.absent(),
                Value<String?> checkpoint = const Value.absent(),
                Value<String?> pinHash = const Value.absent(),
                Value<String?> pinEncrypted = const Value.absent(),
                Value<double?> latitude = const Value.absent(),
                Value<double?> longitude = const Value.absent(),
                Value<double?> accuracy = const Value.absent(),
                Value<DateTime?> locationCapturedAt = const Value.absent(),
                Value<double?> haversineDistance = const Value.absent(),
                Value<bool> isMocked = const Value.absent(),
                Value<String?> inputChannel = const Value.absent(),
                Value<DateTime> scannedAtUtc = const Value.absent(),
                Value<AttendanceSyncStatus> syncStatus = const Value.absent(),
                Value<String?> serverError = const Value.absent(),
                Value<int> retryCount = const Value.absent(),
                Value<DateTime?> lastSentAt = const Value.absent(),
                Value<DateTime> createdAt = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => OfflineAttendanceQueueCompanion(
                clientReceiptId: clientReceiptId,
                userId: userId,
                sessionId: sessionId,
                studentId: studentId,
                scannedToken: scannedToken,
                checkpoint: checkpoint,
                pinHash: pinHash,
                pinEncrypted: pinEncrypted,
                latitude: latitude,
                longitude: longitude,
                accuracy: accuracy,
                locationCapturedAt: locationCapturedAt,
                haversineDistance: haversineDistance,
                isMocked: isMocked,
                inputChannel: inputChannel,
                scannedAtUtc: scannedAtUtc,
                syncStatus: syncStatus,
                serverError: serverError,
                retryCount: retryCount,
                lastSentAt: lastSentAt,
                createdAt: createdAt,
                rowid: rowid,
              ),
          createCompanionCallback:
              ({
                required String clientReceiptId,
                required String userId,
                required String sessionId,
                required String studentId,
                required String scannedToken,
                Value<String?> checkpoint = const Value.absent(),
                Value<String?> pinHash = const Value.absent(),
                Value<String?> pinEncrypted = const Value.absent(),
                Value<double?> latitude = const Value.absent(),
                Value<double?> longitude = const Value.absent(),
                Value<double?> accuracy = const Value.absent(),
                Value<DateTime?> locationCapturedAt = const Value.absent(),
                Value<double?> haversineDistance = const Value.absent(),
                Value<bool> isMocked = const Value.absent(),
                Value<String?> inputChannel = const Value.absent(),
                required DateTime scannedAtUtc,
                required AttendanceSyncStatus syncStatus,
                Value<String?> serverError = const Value.absent(),
                Value<int> retryCount = const Value.absent(),
                Value<DateTime?> lastSentAt = const Value.absent(),
                required DateTime createdAt,
                Value<int> rowid = const Value.absent(),
              }) => OfflineAttendanceQueueCompanion.insert(
                clientReceiptId: clientReceiptId,
                userId: userId,
                sessionId: sessionId,
                studentId: studentId,
                scannedToken: scannedToken,
                checkpoint: checkpoint,
                pinHash: pinHash,
                pinEncrypted: pinEncrypted,
                latitude: latitude,
                longitude: longitude,
                accuracy: accuracy,
                locationCapturedAt: locationCapturedAt,
                haversineDistance: haversineDistance,
                isMocked: isMocked,
                inputChannel: inputChannel,
                scannedAtUtc: scannedAtUtc,
                syncStatus: syncStatus,
                serverError: serverError,
                retryCount: retryCount,
                lastSentAt: lastSentAt,
                createdAt: createdAt,
                rowid: rowid,
              ),
          withReferenceMapper: (p0) => p0
              .map(
                (e) => (
                  e.readTable<
                    $OfflineAttendanceQueueTable,
                    OfflineAttendanceQueueRow
                  >(table),
                  BaseReferences<
                    _$AppDatabase,
                    $OfflineAttendanceQueueTable,
                    OfflineAttendanceQueueRow
                  >(db, table, e),
                ),
              )
              .toList(),
          prefetchHooksCallback: null,
        ),
      );
}

typedef $$OfflineAttendanceQueueTableProcessedTableManager =
    ProcessedTableManager<
      _$AppDatabase,
      $OfflineAttendanceQueueTable,
      OfflineAttendanceQueueRow,
      $$OfflineAttendanceQueueTableFilterComposer,
      $$OfflineAttendanceQueueTableOrderingComposer,
      $$OfflineAttendanceQueueTableAnnotationComposer,
      $$OfflineAttendanceQueueTableCreateCompanionBuilder,
      $$OfflineAttendanceQueueTableUpdateCompanionBuilder,
      (
        OfflineAttendanceQueueRow,
        BaseReferences<
          _$AppDatabase,
          $OfflineAttendanceQueueTable,
          OfflineAttendanceQueueRow
        >,
      ),
      OfflineAttendanceQueueRow,
      PrefetchHooks Function()
    >;
typedef $$SystemReportQueueTableCreateCompanionBuilder =
    SystemReportQueueCompanion Function({
      required String clientReceiptId,
      required String userId,
      required String category,
      required String severity,
      required String title,
      required String description,
      Value<String?> screenshotData,
      Value<String?> deviceInfo,
      Value<String?> appVersion,
      Value<String?> route,
      Value<String?> networkType,
      required OutboxStatus syncStatus,
      Value<String?> serverError,
      Value<int> retryCount,
      Value<DateTime?> lastSentAt,
      required DateTime createdAt,
      Value<int> rowid,
    });
typedef $$SystemReportQueueTableUpdateCompanionBuilder =
    SystemReportQueueCompanion Function({
      Value<String> clientReceiptId,
      Value<String> userId,
      Value<String> category,
      Value<String> severity,
      Value<String> title,
      Value<String> description,
      Value<String?> screenshotData,
      Value<String?> deviceInfo,
      Value<String?> appVersion,
      Value<String?> route,
      Value<String?> networkType,
      Value<OutboxStatus> syncStatus,
      Value<String?> serverError,
      Value<int> retryCount,
      Value<DateTime?> lastSentAt,
      Value<DateTime> createdAt,
      Value<int> rowid,
    });

class $$SystemReportQueueTableFilterComposer
    extends Composer<_$AppDatabase, $SystemReportQueueTable> {
  $$SystemReportQueueTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get clientReceiptId => $composableBuilder(
    column: $table.clientReceiptId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get userId => $composableBuilder(
    column: $table.userId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get category => $composableBuilder(
    column: $table.category,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get severity => $composableBuilder(
    column: $table.severity,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get title => $composableBuilder(
    column: $table.title,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get description => $composableBuilder(
    column: $table.description,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get screenshotData => $composableBuilder(
    column: $table.screenshotData,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get deviceInfo => $composableBuilder(
    column: $table.deviceInfo,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get appVersion => $composableBuilder(
    column: $table.appVersion,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get route => $composableBuilder(
    column: $table.route,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get networkType => $composableBuilder(
    column: $table.networkType,
    builder: (column) => ColumnFilters(column),
  );

  ColumnWithTypeConverterFilters<OutboxStatus, OutboxStatus, String>
  get syncStatus => $composableBuilder(
    column: $table.syncStatus,
    builder: (column) => ColumnWithTypeConverterFilters(column),
  );

  ColumnFilters<String> get serverError => $composableBuilder(
    column: $table.serverError,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get retryCount => $composableBuilder(
    column: $table.retryCount,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<DateTime> get lastSentAt => $composableBuilder(
    column: $table.lastSentAt,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<DateTime> get createdAt => $composableBuilder(
    column: $table.createdAt,
    builder: (column) => ColumnFilters(column),
  );
}

class $$SystemReportQueueTableOrderingComposer
    extends Composer<_$AppDatabase, $SystemReportQueueTable> {
  $$SystemReportQueueTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get clientReceiptId => $composableBuilder(
    column: $table.clientReceiptId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get userId => $composableBuilder(
    column: $table.userId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get category => $composableBuilder(
    column: $table.category,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get severity => $composableBuilder(
    column: $table.severity,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get title => $composableBuilder(
    column: $table.title,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get description => $composableBuilder(
    column: $table.description,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get screenshotData => $composableBuilder(
    column: $table.screenshotData,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get deviceInfo => $composableBuilder(
    column: $table.deviceInfo,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get appVersion => $composableBuilder(
    column: $table.appVersion,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get route => $composableBuilder(
    column: $table.route,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get networkType => $composableBuilder(
    column: $table.networkType,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get syncStatus => $composableBuilder(
    column: $table.syncStatus,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get serverError => $composableBuilder(
    column: $table.serverError,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get retryCount => $composableBuilder(
    column: $table.retryCount,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<DateTime> get lastSentAt => $composableBuilder(
    column: $table.lastSentAt,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<DateTime> get createdAt => $composableBuilder(
    column: $table.createdAt,
    builder: (column) => ColumnOrderings(column),
  );
}

class $$SystemReportQueueTableAnnotationComposer
    extends Composer<_$AppDatabase, $SystemReportQueueTable> {
  $$SystemReportQueueTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get clientReceiptId => $composableBuilder(
    column: $table.clientReceiptId,
    builder: (column) => column,
  );

  GeneratedColumn<String> get userId =>
      $composableBuilder(column: $table.userId, builder: (column) => column);

  GeneratedColumn<String> get category =>
      $composableBuilder(column: $table.category, builder: (column) => column);

  GeneratedColumn<String> get severity =>
      $composableBuilder(column: $table.severity, builder: (column) => column);

  GeneratedColumn<String> get title =>
      $composableBuilder(column: $table.title, builder: (column) => column);

  GeneratedColumn<String> get description => $composableBuilder(
    column: $table.description,
    builder: (column) => column,
  );

  GeneratedColumn<String> get screenshotData => $composableBuilder(
    column: $table.screenshotData,
    builder: (column) => column,
  );

  GeneratedColumn<String> get deviceInfo => $composableBuilder(
    column: $table.deviceInfo,
    builder: (column) => column,
  );

  GeneratedColumn<String> get appVersion => $composableBuilder(
    column: $table.appVersion,
    builder: (column) => column,
  );

  GeneratedColumn<String> get route =>
      $composableBuilder(column: $table.route, builder: (column) => column);

  GeneratedColumn<String> get networkType => $composableBuilder(
    column: $table.networkType,
    builder: (column) => column,
  );

  GeneratedColumnWithTypeConverter<OutboxStatus, String> get syncStatus =>
      $composableBuilder(
        column: $table.syncStatus,
        builder: (column) => column,
      );

  GeneratedColumn<String> get serverError => $composableBuilder(
    column: $table.serverError,
    builder: (column) => column,
  );

  GeneratedColumn<int> get retryCount => $composableBuilder(
    column: $table.retryCount,
    builder: (column) => column,
  );

  GeneratedColumn<DateTime> get lastSentAt => $composableBuilder(
    column: $table.lastSentAt,
    builder: (column) => column,
  );

  GeneratedColumn<DateTime> get createdAt =>
      $composableBuilder(column: $table.createdAt, builder: (column) => column);
}

class $$SystemReportQueueTableTableManager
    extends
        RootTableManager<
          _$AppDatabase,
          $SystemReportQueueTable,
          SystemReportQueueRow,
          $$SystemReportQueueTableFilterComposer,
          $$SystemReportQueueTableOrderingComposer,
          $$SystemReportQueueTableAnnotationComposer,
          $$SystemReportQueueTableCreateCompanionBuilder,
          $$SystemReportQueueTableUpdateCompanionBuilder,
          (
            SystemReportQueueRow,
            BaseReferences<
              _$AppDatabase,
              $SystemReportQueueTable,
              SystemReportQueueRow
            >,
          ),
          SystemReportQueueRow,
          PrefetchHooks Function()
        > {
  $$SystemReportQueueTableTableManager(
    _$AppDatabase db,
    $SystemReportQueueTable table,
  ) : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$SystemReportQueueTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$SystemReportQueueTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$SystemReportQueueTableAnnotationComposer(
                $db: db,
                $table: table,
              ),
          updateCompanionCallback:
              ({
                Value<String> clientReceiptId = const Value.absent(),
                Value<String> userId = const Value.absent(),
                Value<String> category = const Value.absent(),
                Value<String> severity = const Value.absent(),
                Value<String> title = const Value.absent(),
                Value<String> description = const Value.absent(),
                Value<String?> screenshotData = const Value.absent(),
                Value<String?> deviceInfo = const Value.absent(),
                Value<String?> appVersion = const Value.absent(),
                Value<String?> route = const Value.absent(),
                Value<String?> networkType = const Value.absent(),
                Value<OutboxStatus> syncStatus = const Value.absent(),
                Value<String?> serverError = const Value.absent(),
                Value<int> retryCount = const Value.absent(),
                Value<DateTime?> lastSentAt = const Value.absent(),
                Value<DateTime> createdAt = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => SystemReportQueueCompanion(
                clientReceiptId: clientReceiptId,
                userId: userId,
                category: category,
                severity: severity,
                title: title,
                description: description,
                screenshotData: screenshotData,
                deviceInfo: deviceInfo,
                appVersion: appVersion,
                route: route,
                networkType: networkType,
                syncStatus: syncStatus,
                serverError: serverError,
                retryCount: retryCount,
                lastSentAt: lastSentAt,
                createdAt: createdAt,
                rowid: rowid,
              ),
          createCompanionCallback:
              ({
                required String clientReceiptId,
                required String userId,
                required String category,
                required String severity,
                required String title,
                required String description,
                Value<String?> screenshotData = const Value.absent(),
                Value<String?> deviceInfo = const Value.absent(),
                Value<String?> appVersion = const Value.absent(),
                Value<String?> route = const Value.absent(),
                Value<String?> networkType = const Value.absent(),
                required OutboxStatus syncStatus,
                Value<String?> serverError = const Value.absent(),
                Value<int> retryCount = const Value.absent(),
                Value<DateTime?> lastSentAt = const Value.absent(),
                required DateTime createdAt,
                Value<int> rowid = const Value.absent(),
              }) => SystemReportQueueCompanion.insert(
                clientReceiptId: clientReceiptId,
                userId: userId,
                category: category,
                severity: severity,
                title: title,
                description: description,
                screenshotData: screenshotData,
                deviceInfo: deviceInfo,
                appVersion: appVersion,
                route: route,
                networkType: networkType,
                syncStatus: syncStatus,
                serverError: serverError,
                retryCount: retryCount,
                lastSentAt: lastSentAt,
                createdAt: createdAt,
                rowid: rowid,
              ),
          withReferenceMapper: (p0) => p0
              .map(
                (e) => (
                  e.readTable<$SystemReportQueueTable, SystemReportQueueRow>(
                    table,
                  ),
                  BaseReferences<
                    _$AppDatabase,
                    $SystemReportQueueTable,
                    SystemReportQueueRow
                  >(db, table, e),
                ),
              )
              .toList(),
          prefetchHooksCallback: null,
        ),
      );
}

typedef $$SystemReportQueueTableProcessedTableManager =
    ProcessedTableManager<
      _$AppDatabase,
      $SystemReportQueueTable,
      SystemReportQueueRow,
      $$SystemReportQueueTableFilterComposer,
      $$SystemReportQueueTableOrderingComposer,
      $$SystemReportQueueTableAnnotationComposer,
      $$SystemReportQueueTableCreateCompanionBuilder,
      $$SystemReportQueueTableUpdateCompanionBuilder,
      (
        SystemReportQueueRow,
        BaseReferences<
          _$AppDatabase,
          $SystemReportQueueTable,
          SystemReportQueueRow
        >,
      ),
      SystemReportQueueRow,
      PrefetchHooks Function()
    >;
typedef $$ExcuseQueueTableCreateCompanionBuilder =
    ExcuseQueueCompanion Function({
      required String clientReceiptId,
      required String userId,
      required String recordId,
      required String reason,
      required String description,
      Value<String?> evidenceData,
      required OutboxStatus syncStatus,
      Value<String?> serverError,
      Value<int> retryCount,
      Value<DateTime?> lastSentAt,
      required DateTime createdAt,
      Value<int> rowid,
    });
typedef $$ExcuseQueueTableUpdateCompanionBuilder =
    ExcuseQueueCompanion Function({
      Value<String> clientReceiptId,
      Value<String> userId,
      Value<String> recordId,
      Value<String> reason,
      Value<String> description,
      Value<String?> evidenceData,
      Value<OutboxStatus> syncStatus,
      Value<String?> serverError,
      Value<int> retryCount,
      Value<DateTime?> lastSentAt,
      Value<DateTime> createdAt,
      Value<int> rowid,
    });

class $$ExcuseQueueTableFilterComposer
    extends Composer<_$AppDatabase, $ExcuseQueueTable> {
  $$ExcuseQueueTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get clientReceiptId => $composableBuilder(
    column: $table.clientReceiptId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get userId => $composableBuilder(
    column: $table.userId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get recordId => $composableBuilder(
    column: $table.recordId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get reason => $composableBuilder(
    column: $table.reason,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get description => $composableBuilder(
    column: $table.description,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get evidenceData => $composableBuilder(
    column: $table.evidenceData,
    builder: (column) => ColumnFilters(column),
  );

  ColumnWithTypeConverterFilters<OutboxStatus, OutboxStatus, String>
  get syncStatus => $composableBuilder(
    column: $table.syncStatus,
    builder: (column) => ColumnWithTypeConverterFilters(column),
  );

  ColumnFilters<String> get serverError => $composableBuilder(
    column: $table.serverError,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get retryCount => $composableBuilder(
    column: $table.retryCount,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<DateTime> get lastSentAt => $composableBuilder(
    column: $table.lastSentAt,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<DateTime> get createdAt => $composableBuilder(
    column: $table.createdAt,
    builder: (column) => ColumnFilters(column),
  );
}

class $$ExcuseQueueTableOrderingComposer
    extends Composer<_$AppDatabase, $ExcuseQueueTable> {
  $$ExcuseQueueTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get clientReceiptId => $composableBuilder(
    column: $table.clientReceiptId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get userId => $composableBuilder(
    column: $table.userId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get recordId => $composableBuilder(
    column: $table.recordId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get reason => $composableBuilder(
    column: $table.reason,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get description => $composableBuilder(
    column: $table.description,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get evidenceData => $composableBuilder(
    column: $table.evidenceData,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get syncStatus => $composableBuilder(
    column: $table.syncStatus,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get serverError => $composableBuilder(
    column: $table.serverError,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get retryCount => $composableBuilder(
    column: $table.retryCount,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<DateTime> get lastSentAt => $composableBuilder(
    column: $table.lastSentAt,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<DateTime> get createdAt => $composableBuilder(
    column: $table.createdAt,
    builder: (column) => ColumnOrderings(column),
  );
}

class $$ExcuseQueueTableAnnotationComposer
    extends Composer<_$AppDatabase, $ExcuseQueueTable> {
  $$ExcuseQueueTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get clientReceiptId => $composableBuilder(
    column: $table.clientReceiptId,
    builder: (column) => column,
  );

  GeneratedColumn<String> get userId =>
      $composableBuilder(column: $table.userId, builder: (column) => column);

  GeneratedColumn<String> get recordId =>
      $composableBuilder(column: $table.recordId, builder: (column) => column);

  GeneratedColumn<String> get reason =>
      $composableBuilder(column: $table.reason, builder: (column) => column);

  GeneratedColumn<String> get description => $composableBuilder(
    column: $table.description,
    builder: (column) => column,
  );

  GeneratedColumn<String> get evidenceData => $composableBuilder(
    column: $table.evidenceData,
    builder: (column) => column,
  );

  GeneratedColumnWithTypeConverter<OutboxStatus, String> get syncStatus =>
      $composableBuilder(
        column: $table.syncStatus,
        builder: (column) => column,
      );

  GeneratedColumn<String> get serverError => $composableBuilder(
    column: $table.serverError,
    builder: (column) => column,
  );

  GeneratedColumn<int> get retryCount => $composableBuilder(
    column: $table.retryCount,
    builder: (column) => column,
  );

  GeneratedColumn<DateTime> get lastSentAt => $composableBuilder(
    column: $table.lastSentAt,
    builder: (column) => column,
  );

  GeneratedColumn<DateTime> get createdAt =>
      $composableBuilder(column: $table.createdAt, builder: (column) => column);
}

class $$ExcuseQueueTableTableManager
    extends
        RootTableManager<
          _$AppDatabase,
          $ExcuseQueueTable,
          ExcuseQueueRow,
          $$ExcuseQueueTableFilterComposer,
          $$ExcuseQueueTableOrderingComposer,
          $$ExcuseQueueTableAnnotationComposer,
          $$ExcuseQueueTableCreateCompanionBuilder,
          $$ExcuseQueueTableUpdateCompanionBuilder,
          (
            ExcuseQueueRow,
            BaseReferences<_$AppDatabase, $ExcuseQueueTable, ExcuseQueueRow>,
          ),
          ExcuseQueueRow,
          PrefetchHooks Function()
        > {
  $$ExcuseQueueTableTableManager(_$AppDatabase db, $ExcuseQueueTable table)
    : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$ExcuseQueueTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$ExcuseQueueTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$ExcuseQueueTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback:
              ({
                Value<String> clientReceiptId = const Value.absent(),
                Value<String> userId = const Value.absent(),
                Value<String> recordId = const Value.absent(),
                Value<String> reason = const Value.absent(),
                Value<String> description = const Value.absent(),
                Value<String?> evidenceData = const Value.absent(),
                Value<OutboxStatus> syncStatus = const Value.absent(),
                Value<String?> serverError = const Value.absent(),
                Value<int> retryCount = const Value.absent(),
                Value<DateTime?> lastSentAt = const Value.absent(),
                Value<DateTime> createdAt = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => ExcuseQueueCompanion(
                clientReceiptId: clientReceiptId,
                userId: userId,
                recordId: recordId,
                reason: reason,
                description: description,
                evidenceData: evidenceData,
                syncStatus: syncStatus,
                serverError: serverError,
                retryCount: retryCount,
                lastSentAt: lastSentAt,
                createdAt: createdAt,
                rowid: rowid,
              ),
          createCompanionCallback:
              ({
                required String clientReceiptId,
                required String userId,
                required String recordId,
                required String reason,
                required String description,
                Value<String?> evidenceData = const Value.absent(),
                required OutboxStatus syncStatus,
                Value<String?> serverError = const Value.absent(),
                Value<int> retryCount = const Value.absent(),
                Value<DateTime?> lastSentAt = const Value.absent(),
                required DateTime createdAt,
                Value<int> rowid = const Value.absent(),
              }) => ExcuseQueueCompanion.insert(
                clientReceiptId: clientReceiptId,
                userId: userId,
                recordId: recordId,
                reason: reason,
                description: description,
                evidenceData: evidenceData,
                syncStatus: syncStatus,
                serverError: serverError,
                retryCount: retryCount,
                lastSentAt: lastSentAt,
                createdAt: createdAt,
                rowid: rowid,
              ),
          withReferenceMapper: (p0) => p0
              .map(
                (e) => (
                  e.readTable<$ExcuseQueueTable, ExcuseQueueRow>(table),
                  BaseReferences<
                    _$AppDatabase,
                    $ExcuseQueueTable,
                    ExcuseQueueRow
                  >(db, table, e),
                ),
              )
              .toList(),
          prefetchHooksCallback: null,
        ),
      );
}

typedef $$ExcuseQueueTableProcessedTableManager =
    ProcessedTableManager<
      _$AppDatabase,
      $ExcuseQueueTable,
      ExcuseQueueRow,
      $$ExcuseQueueTableFilterComposer,
      $$ExcuseQueueTableOrderingComposer,
      $$ExcuseQueueTableAnnotationComposer,
      $$ExcuseQueueTableCreateCompanionBuilder,
      $$ExcuseQueueTableUpdateCompanionBuilder,
      (
        ExcuseQueueRow,
        BaseReferences<_$AppDatabase, $ExcuseQueueTable, ExcuseQueueRow>,
      ),
      ExcuseQueueRow,
      PrefetchHooks Function()
    >;
typedef $$NotificationsInboxTableCreateCompanionBuilder =
    NotificationsInboxCompanion Function({
      required String userId,
      required String notificationId,
      required NotificationType type,
      Value<String> title,
      Value<String> body,
      required String payloadJson,
      Value<DateTime?> readAt,
      required DateTime createdAt,
      Value<String?> deepLink,
      Value<int> rowid,
    });
typedef $$NotificationsInboxTableUpdateCompanionBuilder =
    NotificationsInboxCompanion Function({
      Value<String> userId,
      Value<String> notificationId,
      Value<NotificationType> type,
      Value<String> title,
      Value<String> body,
      Value<String> payloadJson,
      Value<DateTime?> readAt,
      Value<DateTime> createdAt,
      Value<String?> deepLink,
      Value<int> rowid,
    });

class $$NotificationsInboxTableFilterComposer
    extends Composer<_$AppDatabase, $NotificationsInboxTable> {
  $$NotificationsInboxTableFilterComposer({
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

  ColumnFilters<String> get notificationId => $composableBuilder(
    column: $table.notificationId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnWithTypeConverterFilters<NotificationType, NotificationType, String>
  get type => $composableBuilder(
    column: $table.type,
    builder: (column) => ColumnWithTypeConverterFilters(column),
  );

  ColumnFilters<String> get title => $composableBuilder(
    column: $table.title,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get body => $composableBuilder(
    column: $table.body,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get payloadJson => $composableBuilder(
    column: $table.payloadJson,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<DateTime> get readAt => $composableBuilder(
    column: $table.readAt,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<DateTime> get createdAt => $composableBuilder(
    column: $table.createdAt,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get deepLink => $composableBuilder(
    column: $table.deepLink,
    builder: (column) => ColumnFilters(column),
  );
}

class $$NotificationsInboxTableOrderingComposer
    extends Composer<_$AppDatabase, $NotificationsInboxTable> {
  $$NotificationsInboxTableOrderingComposer({
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

  ColumnOrderings<String> get notificationId => $composableBuilder(
    column: $table.notificationId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get type => $composableBuilder(
    column: $table.type,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get title => $composableBuilder(
    column: $table.title,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get body => $composableBuilder(
    column: $table.body,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get payloadJson => $composableBuilder(
    column: $table.payloadJson,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<DateTime> get readAt => $composableBuilder(
    column: $table.readAt,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<DateTime> get createdAt => $composableBuilder(
    column: $table.createdAt,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get deepLink => $composableBuilder(
    column: $table.deepLink,
    builder: (column) => ColumnOrderings(column),
  );
}

class $$NotificationsInboxTableAnnotationComposer
    extends Composer<_$AppDatabase, $NotificationsInboxTable> {
  $$NotificationsInboxTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get userId =>
      $composableBuilder(column: $table.userId, builder: (column) => column);

  GeneratedColumn<String> get notificationId => $composableBuilder(
    column: $table.notificationId,
    builder: (column) => column,
  );

  GeneratedColumnWithTypeConverter<NotificationType, String> get type =>
      $composableBuilder(column: $table.type, builder: (column) => column);

  GeneratedColumn<String> get title =>
      $composableBuilder(column: $table.title, builder: (column) => column);

  GeneratedColumn<String> get body =>
      $composableBuilder(column: $table.body, builder: (column) => column);

  GeneratedColumn<String> get payloadJson => $composableBuilder(
    column: $table.payloadJson,
    builder: (column) => column,
  );

  GeneratedColumn<DateTime> get readAt =>
      $composableBuilder(column: $table.readAt, builder: (column) => column);

  GeneratedColumn<DateTime> get createdAt =>
      $composableBuilder(column: $table.createdAt, builder: (column) => column);

  GeneratedColumn<String> get deepLink =>
      $composableBuilder(column: $table.deepLink, builder: (column) => column);
}

class $$NotificationsInboxTableTableManager
    extends
        RootTableManager<
          _$AppDatabase,
          $NotificationsInboxTable,
          NotificationInboxRow,
          $$NotificationsInboxTableFilterComposer,
          $$NotificationsInboxTableOrderingComposer,
          $$NotificationsInboxTableAnnotationComposer,
          $$NotificationsInboxTableCreateCompanionBuilder,
          $$NotificationsInboxTableUpdateCompanionBuilder,
          (
            NotificationInboxRow,
            BaseReferences<
              _$AppDatabase,
              $NotificationsInboxTable,
              NotificationInboxRow
            >,
          ),
          NotificationInboxRow,
          PrefetchHooks Function()
        > {
  $$NotificationsInboxTableTableManager(
    _$AppDatabase db,
    $NotificationsInboxTable table,
  ) : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$NotificationsInboxTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$NotificationsInboxTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$NotificationsInboxTableAnnotationComposer(
                $db: db,
                $table: table,
              ),
          updateCompanionCallback:
              ({
                Value<String> userId = const Value.absent(),
                Value<String> notificationId = const Value.absent(),
                Value<NotificationType> type = const Value.absent(),
                Value<String> title = const Value.absent(),
                Value<String> body = const Value.absent(),
                Value<String> payloadJson = const Value.absent(),
                Value<DateTime?> readAt = const Value.absent(),
                Value<DateTime> createdAt = const Value.absent(),
                Value<String?> deepLink = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => NotificationsInboxCompanion(
                userId: userId,
                notificationId: notificationId,
                type: type,
                title: title,
                body: body,
                payloadJson: payloadJson,
                readAt: readAt,
                createdAt: createdAt,
                deepLink: deepLink,
                rowid: rowid,
              ),
          createCompanionCallback:
              ({
                required String userId,
                required String notificationId,
                required NotificationType type,
                Value<String> title = const Value.absent(),
                Value<String> body = const Value.absent(),
                required String payloadJson,
                Value<DateTime?> readAt = const Value.absent(),
                required DateTime createdAt,
                Value<String?> deepLink = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => NotificationsInboxCompanion.insert(
                userId: userId,
                notificationId: notificationId,
                type: type,
                title: title,
                body: body,
                payloadJson: payloadJson,
                readAt: readAt,
                createdAt: createdAt,
                deepLink: deepLink,
                rowid: rowid,
              ),
          withReferenceMapper: (p0) => p0
              .map(
                (e) => (
                  e.readTable<$NotificationsInboxTable, NotificationInboxRow>(
                    table,
                  ),
                  BaseReferences<
                    _$AppDatabase,
                    $NotificationsInboxTable,
                    NotificationInboxRow
                  >(db, table, e),
                ),
              )
              .toList(),
          prefetchHooksCallback: null,
        ),
      );
}

typedef $$NotificationsInboxTableProcessedTableManager =
    ProcessedTableManager<
      _$AppDatabase,
      $NotificationsInboxTable,
      NotificationInboxRow,
      $$NotificationsInboxTableFilterComposer,
      $$NotificationsInboxTableOrderingComposer,
      $$NotificationsInboxTableAnnotationComposer,
      $$NotificationsInboxTableCreateCompanionBuilder,
      $$NotificationsInboxTableUpdateCompanionBuilder,
      (
        NotificationInboxRow,
        BaseReferences<
          _$AppDatabase,
          $NotificationsInboxTable,
          NotificationInboxRow
        >,
      ),
      NotificationInboxRow,
      PrefetchHooks Function()
    >;
typedef $$CachedMetaTableCreateCompanionBuilder =
    CachedMetaCompanion Function({
      required String userId,
      Value<int?> clockOffsetMs,
      Value<DateTime?> clockOffsetUpdatedAt,
      Value<DateTime?> lastSyncAt,
      Value<String?> enrolledSectionIdsJson,
      Value<String?> profileJson,
      Value<String?> activeProfileUserId,
      Value<int> rowid,
    });
typedef $$CachedMetaTableUpdateCompanionBuilder =
    CachedMetaCompanion Function({
      Value<String> userId,
      Value<int?> clockOffsetMs,
      Value<DateTime?> clockOffsetUpdatedAt,
      Value<DateTime?> lastSyncAt,
      Value<String?> enrolledSectionIdsJson,
      Value<String?> profileJson,
      Value<String?> activeProfileUserId,
      Value<int> rowid,
    });

class $$CachedMetaTableFilterComposer
    extends Composer<_$AppDatabase, $CachedMetaTable> {
  $$CachedMetaTableFilterComposer({
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

  ColumnFilters<int> get clockOffsetMs => $composableBuilder(
    column: $table.clockOffsetMs,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<DateTime> get clockOffsetUpdatedAt => $composableBuilder(
    column: $table.clockOffsetUpdatedAt,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<DateTime> get lastSyncAt => $composableBuilder(
    column: $table.lastSyncAt,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get enrolledSectionIdsJson => $composableBuilder(
    column: $table.enrolledSectionIdsJson,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get profileJson => $composableBuilder(
    column: $table.profileJson,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get activeProfileUserId => $composableBuilder(
    column: $table.activeProfileUserId,
    builder: (column) => ColumnFilters(column),
  );
}

class $$CachedMetaTableOrderingComposer
    extends Composer<_$AppDatabase, $CachedMetaTable> {
  $$CachedMetaTableOrderingComposer({
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

  ColumnOrderings<int> get clockOffsetMs => $composableBuilder(
    column: $table.clockOffsetMs,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<DateTime> get clockOffsetUpdatedAt => $composableBuilder(
    column: $table.clockOffsetUpdatedAt,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<DateTime> get lastSyncAt => $composableBuilder(
    column: $table.lastSyncAt,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get enrolledSectionIdsJson => $composableBuilder(
    column: $table.enrolledSectionIdsJson,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get profileJson => $composableBuilder(
    column: $table.profileJson,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get activeProfileUserId => $composableBuilder(
    column: $table.activeProfileUserId,
    builder: (column) => ColumnOrderings(column),
  );
}

class $$CachedMetaTableAnnotationComposer
    extends Composer<_$AppDatabase, $CachedMetaTable> {
  $$CachedMetaTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get userId =>
      $composableBuilder(column: $table.userId, builder: (column) => column);

  GeneratedColumn<int> get clockOffsetMs => $composableBuilder(
    column: $table.clockOffsetMs,
    builder: (column) => column,
  );

  GeneratedColumn<DateTime> get clockOffsetUpdatedAt => $composableBuilder(
    column: $table.clockOffsetUpdatedAt,
    builder: (column) => column,
  );

  GeneratedColumn<DateTime> get lastSyncAt => $composableBuilder(
    column: $table.lastSyncAt,
    builder: (column) => column,
  );

  GeneratedColumn<String> get enrolledSectionIdsJson => $composableBuilder(
    column: $table.enrolledSectionIdsJson,
    builder: (column) => column,
  );

  GeneratedColumn<String> get profileJson => $composableBuilder(
    column: $table.profileJson,
    builder: (column) => column,
  );

  GeneratedColumn<String> get activeProfileUserId => $composableBuilder(
    column: $table.activeProfileUserId,
    builder: (column) => column,
  );
}

class $$CachedMetaTableTableManager
    extends
        RootTableManager<
          _$AppDatabase,
          $CachedMetaTable,
          CachedMetaRow,
          $$CachedMetaTableFilterComposer,
          $$CachedMetaTableOrderingComposer,
          $$CachedMetaTableAnnotationComposer,
          $$CachedMetaTableCreateCompanionBuilder,
          $$CachedMetaTableUpdateCompanionBuilder,
          (
            CachedMetaRow,
            BaseReferences<_$AppDatabase, $CachedMetaTable, CachedMetaRow>,
          ),
          CachedMetaRow,
          PrefetchHooks Function()
        > {
  $$CachedMetaTableTableManager(_$AppDatabase db, $CachedMetaTable table)
    : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$CachedMetaTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$CachedMetaTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$CachedMetaTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback:
              ({
                Value<String> userId = const Value.absent(),
                Value<int?> clockOffsetMs = const Value.absent(),
                Value<DateTime?> clockOffsetUpdatedAt = const Value.absent(),
                Value<DateTime?> lastSyncAt = const Value.absent(),
                Value<String?> enrolledSectionIdsJson = const Value.absent(),
                Value<String?> profileJson = const Value.absent(),
                Value<String?> activeProfileUserId = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => CachedMetaCompanion(
                userId: userId,
                clockOffsetMs: clockOffsetMs,
                clockOffsetUpdatedAt: clockOffsetUpdatedAt,
                lastSyncAt: lastSyncAt,
                enrolledSectionIdsJson: enrolledSectionIdsJson,
                profileJson: profileJson,
                activeProfileUserId: activeProfileUserId,
                rowid: rowid,
              ),
          createCompanionCallback:
              ({
                required String userId,
                Value<int?> clockOffsetMs = const Value.absent(),
                Value<DateTime?> clockOffsetUpdatedAt = const Value.absent(),
                Value<DateTime?> lastSyncAt = const Value.absent(),
                Value<String?> enrolledSectionIdsJson = const Value.absent(),
                Value<String?> profileJson = const Value.absent(),
                Value<String?> activeProfileUserId = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => CachedMetaCompanion.insert(
                userId: userId,
                clockOffsetMs: clockOffsetMs,
                clockOffsetUpdatedAt: clockOffsetUpdatedAt,
                lastSyncAt: lastSyncAt,
                enrolledSectionIdsJson: enrolledSectionIdsJson,
                profileJson: profileJson,
                activeProfileUserId: activeProfileUserId,
                rowid: rowid,
              ),
          withReferenceMapper: (p0) => p0
              .map(
                (e) => (
                  e.readTable<$CachedMetaTable, CachedMetaRow>(table),
                  BaseReferences<
                    _$AppDatabase,
                    $CachedMetaTable,
                    CachedMetaRow
                  >(db, table, e),
                ),
              )
              .toList(),
          prefetchHooksCallback: null,
        ),
      );
}

typedef $$CachedMetaTableProcessedTableManager =
    ProcessedTableManager<
      _$AppDatabase,
      $CachedMetaTable,
      CachedMetaRow,
      $$CachedMetaTableFilterComposer,
      $$CachedMetaTableOrderingComposer,
      $$CachedMetaTableAnnotationComposer,
      $$CachedMetaTableCreateCompanionBuilder,
      $$CachedMetaTableUpdateCompanionBuilder,
      (
        CachedMetaRow,
        BaseReferences<_$AppDatabase, $CachedMetaTable, CachedMetaRow>,
      ),
      CachedMetaRow,
      PrefetchHooks Function()
    >;

class $AppDatabaseManager {
  final _$AppDatabase _db;
  $AppDatabaseManager(this._db);
  $$CachedSubjectsTableTableManager get cachedSubjects =>
      $$CachedSubjectsTableTableManager(_db, _db.cachedSubjects);
  $$CachedSectionsTableTableManager get cachedSections =>
      $$CachedSectionsTableTableManager(_db, _db.cachedSections);
  $$CachedSchedulesTableTableManager get cachedSchedules =>
      $$CachedSchedulesTableTableManager(_db, _db.cachedSchedules);
  $$CachedSessionsTableTableManager get cachedSessions =>
      $$CachedSessionsTableTableManager(_db, _db.cachedSessions);
  $$CachedRostersTableTableManager get cachedRosters =>
      $$CachedRostersTableTableManager(_db, _db.cachedRosters);
  $$CachedAttendanceTableTableManager get cachedAttendance =>
      $$CachedAttendanceTableTableManager(_db, _db.cachedAttendance);
  $$OfflineAttendanceQueueTableTableManager get offlineAttendanceQueue =>
      $$OfflineAttendanceQueueTableTableManager(
        _db,
        _db.offlineAttendanceQueue,
      );
  $$SystemReportQueueTableTableManager get systemReportQueue =>
      $$SystemReportQueueTableTableManager(_db, _db.systemReportQueue);
  $$ExcuseQueueTableTableManager get excuseQueue =>
      $$ExcuseQueueTableTableManager(_db, _db.excuseQueue);
  $$NotificationsInboxTableTableManager get notificationsInbox =>
      $$NotificationsInboxTableTableManager(_db, _db.notificationsInbox);
  $$CachedMetaTableTableManager get cachedMeta =>
      $$CachedMetaTableTableManager(_db, _db.cachedMeta);
}
