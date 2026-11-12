// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'privacy.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_PrivacyConsentSnapshot _$PrivacyConsentSnapshotFromJson(
  Map<String, dynamic> json,
) => _PrivacyConsentSnapshot(
  covered: (json['covered'] as num?)?.toInt() ?? 0,
  totalActive: (json['totalActive'] as num?)?.toInt() ?? 0,
  version: json['version'] as String? ?? '',
);

Map<String, dynamic> _$PrivacyConsentSnapshotToJson(
  _PrivacyConsentSnapshot instance,
) => <String, dynamic>{
  'covered': instance.covered,
  'totalActive': instance.totalActive,
  'version': instance.version,
};

_PrivacyEphemeralSnapshot _$PrivacyEphemeralSnapshotFromJson(
  Map<String, dynamic> json,
) => _PrivacyEphemeralSnapshot(
  lastRunAt: json['lastRunAt'] as String?,
  recordsShredded: (json['recordsShredded'] as num?)?.toInt(),
  attemptsShredded: (json['attemptsShredded'] as num?)?.toInt(),
);

Map<String, dynamic> _$PrivacyEphemeralSnapshotToJson(
  _PrivacyEphemeralSnapshot instance,
) => <String, dynamic>{
  'lastRunAt': instance.lastRunAt,
  'recordsShredded': instance.recordsShredded,
  'attemptsShredded': instance.attemptsShredded,
};

_PrivacyDataInventoryRow _$PrivacyDataInventoryRowFromJson(
  Map<String, dynamic> json,
) => _PrivacyDataInventoryRow(
  data: json['data'] as String,
  purpose: json['purpose'] as String,
  lawfulBasis: json['lawfulBasis'] as String,
  lifetime: json['lifetime'] as String,
);

Map<String, dynamic> _$PrivacyDataInventoryRowToJson(
  _PrivacyDataInventoryRow instance,
) => <String, dynamic>{
  'data': instance.data,
  'purpose': instance.purpose,
  'lawfulBasis': instance.lawfulBasis,
  'lifetime': instance.lifetime,
};

_PrivacyCenterSnapshot _$PrivacyCenterSnapshotFromJson(
  Map<String, dynamic> json,
) => _PrivacyCenterSnapshot(
  retentionDays:
      (json['retentionDays'] as num?)?.toInt() ??
      geolocationRetentionDefaultDays,
  consent: PrivacyConsentSnapshot.fromJson(
    json['consent'] as Map<String, dynamic>,
  ),
  ephemeral: PrivacyEphemeralSnapshot.fromJson(
    json['ephemeral'] as Map<String, dynamic>,
  ),
  dataInventory:
      (json['dataInventory'] as List<dynamic>?)
          ?.map(
            (e) => PrivacyDataInventoryRow.fromJson(e as Map<String, dynamic>),
          )
          .toList() ??
      const <PrivacyDataInventoryRow>[],
  breaches: json['breaches'] as List<dynamic>? ?? const <Object?>[],
);

Map<String, dynamic> _$PrivacyCenterSnapshotToJson(
  _PrivacyCenterSnapshot instance,
) => <String, dynamic>{
  'retentionDays': instance.retentionDays,
  'consent': instance.consent.toJson(),
  'ephemeral': instance.ephemeral.toJson(),
  'dataInventory': instance.dataInventory.map((e) => e.toJson()).toList(),
  'breaches': instance.breaches,
};
