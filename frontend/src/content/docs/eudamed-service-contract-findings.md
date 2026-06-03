# EUDAMED Service Contract Findings

## Purpose

This note captures the key EUDAMED XML testing findings so far and the resulting application design decisions.

The aim is to keep this section short and shareable:

- what has been tested
- what has worked
- what decisions now follow
- what comes next

## Key Testing Findings

### 1. Schema Version

The original `3.0.28` message version was rejected by EUDAMED.

The project was updated to:

- use schema pack `3.0.30`
- emit `m:Push/@version = 3.0.30`

This resolved the initial version-level rejection.

### 2. Successful XML Patterns

Three successful XML references now matter most:

1. successful `DEVICE.POST` generated from this application
2. successful colleague `UDI_DI.POST`
3. successful colleague `UDI_DI.PATCH`

These prove that:

- `DEVICE.POST` can succeed with a fuller `device:Device` payload
- `UDI_DI.POST` can also succeed with direct `device:UDIDIData`
- `UDI_DI.PATCH` can succeed with direct `device:UDIDIData`

### 3. Current PATCH Error Signals

The most useful live `PATCH` error signals are:

- version handling is not yet correct for EUDAMED incremental versioning
- market information updates are a separate concern and should not drive the immediate `PATCH` redesign

For now, market-information update design is being left aside so the application can first reach a cleaner working core `PATCH`.

## Successful Reference Shapes

### `DEVICE.POST`

- `serviceID = DEVICE`
- `serviceOperation = POST`
- payload root:
  - `device:Device`
- payload content:
  - `device:MDRBasicUDI`
  - `device:MDRUDIDIData`

### `UDI_DI.POST`

- `serviceID = UDI_DI`
- `serviceOperation = POST`
- payload root:
  - `device:UDIDIData`

### `UDI_DI.PATCH`

- `serviceID = UDI_DI`
- `serviceOperation = PATCH`
- payload root:
  - `device:UDIDIData`
- lifecycle:
  - `e:state`
  - `e:version`

## Current Design Decisions

The application should now move to the following default XML-generation design:

### POST

Use:

- `DEVICE.POST`

Render:

- `device:Device`
- with:
  - `device:MDRBasicUDI`
  - `device:MDRUDIDIData`

Reason:

- this path is directly proven by a successful XML generated from this application
- it is the strongest current create-path evidence

### PATCH

Use:

- `UDI_DI.PATCH`

Render:

- direct `device:UDIDIData`

Reason:

- this is the strongest currently proven update-path evidence
- there is no successful `DEVICE.PATCH` example available

### UDI_DI.POST

Position:

- keep documented as a proven alternative successful pattern
- do not use it as the default active generator path for now

## PATCH Simplification Decision

The immediate goal for `PATCH` is to produce a smaller, cleaner update payload first, then expand only if needed.

So the current design direction is:

- keep core UDI-DI update fields
- keep `e:state`
- keep `e:version`
- exclude `marketInfos` from the current default `PATCH` path
- leave wider market-information redesign aside for now

This means the next `PATCH` iteration should be treated as a controlled minimal update path rather than a full canonical projection.

## What The Current App Still Does Differently

Compared with the successful leaner `UDI_DI` examples, the current application-generated `UDI_DI` files have tended to:

- emit a narrower `productionIdentifier` value than the successful examples

These differences remain relevant, but they are secondary to the main service-contract decisions above.

## Next Steps

1. Redesign XML generation so `POST` uses `DEVICE.POST` with the fuller Device wrapper.
2. Redesign XML generation so `PATCH` uses `UDI_DI.PATCH` with direct `UDIDIData`.
3. Keep `UDI_DI.POST` documented, but not as the default generator path.
4. Make the next `PATCH` payload intentionally minimal and retest.
5. Revisit market-information update handling later as a separate design track.

## Current Position

The strongest current evidence supports this default application contract:

- `POST` -> `DEVICE.POST`
- `PATCH` -> `UDI_DI.PATCH`

That is the design baseline now recommended for the next application changes.
