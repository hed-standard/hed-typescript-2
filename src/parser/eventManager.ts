/**
 * This module holds the classes for managing events in BIDS datasets.
 * @module parser/eventManager
 */

import type ParsedHedGroup from './parsedHedGroup'
import { BidsHedIssue } from '../bids/types/issues'
import { type BidsTsvElement } from '../bids/types/tsv'
import { generateIssue, IssueError } from '../issues/issues'
import { FilePath } from '../bids/types/file'

export class Event {
  /**
   * The name of the definition.
   */
  readonly onset: number

  /**
   * The parsed HED group representing the definition.
   */
  readonly defName: string

  /**
   * The short name of the tag representing this event ("Onset", "Inset", or "Offset").
   */
  readonly type: string

  /**
   * The parsed HED group representing the definition.
   */
  readonly group: ParsedHedGroup

  /**
   * The file this element belongs to (usually just the path).
   */
  readonly file: FilePath

  /**
   * The line number(s) (including the header) represented by this element.
   */
  readonly tsvLine: string

  private constructor(
    defName: string,
    eventType: string,
    onset: number,
    group: ParsedHedGroup,
    element: BidsTsvElement,
  ) {
    this.defName = defName
    this.type = eventType
    this.onset = onset
    this.group = group
    this.file = element.file
    this.tsvLine = element.tsvLine
  }

  /**
   * Create an event from a ParsedHedGroup.
   *
   * @param group - A group to extract an event from a temporal group, if it is a group.
   * @param element - The element in which this group appears.
   * @returns A tuple representing the extracted event and issues.
   */
  public static createEvent(group: ParsedHedGroup, element: BidsTsvElement): [Event | null, BidsHedIssue[]] {
    if (group.requiresDefTag.length === 0 && !group.reservedTags.has('Delay')) {
      return [null, []]
    }
    let onset = Number(element.onset)
    if (!Number.isFinite(onset)) {
      return [
        null,
        [
          BidsHedIssue.fromHedIssue(
            generateIssue('temporalTagInNonTemporalContext', { string: element.hedString }),
            element.file,
            { tsvLine: element.tsvLine },
          ),
        ],
      ]
    }
    if (group.requiresDefTag.length === 0) {
      return [null, []]
    }
    onset = onset + Event.extractDelay(group)
    const eventType = group.requiresDefTag[0].schemaTag.name
    let defName = null
    if (group.defTags.length === 1) {
      defName = group.defTags[0].remainder.toLowerCase()
    } else if (group.defExpandChildren.length === 1) {
      defName = group.defExpandChildren[0].topTags[0].remainder.toLowerCase()
    } else {
      return [
        null,
        [
          BidsHedIssue.fromHedIssue(
            generateIssue('temporalWithWrongNumberDefs', { tagGroup: group.originalTag, tag: eventType }),
            element.file,
            { tsvLine: element.tsvLine },
          ),
        ],
      ]
    }
    const event = new Event(defName, eventType, onset, group, element)
    return [event, []]
  }

  private static extractDelay(group: ParsedHedGroup): number {
    const tags = group.reservedTags.get('Delay')
    if (tags === undefined) {
      return 0
    }
    const delay = Number(tags[0].value)
    return Number.isFinite(delay) ? delay : 0
  }
}

export class EventManager {
  static readonly TOLERANCE = 1e-7

  /**
   * Create a list of temporal events from BIDS elements.
   *
   * @param elements - The elements representing the contents of a tsv file.
   * @returns A tuple with the parsed event and any issues.
   */
  public parseEvents(elements: BidsTsvElement[]): [Event[], BidsHedIssue[]] {
    const eventList: Event[] = []
    for (const element of elements) {
      if (!element.parsedHedString) {
        continue
      }

      for (const group of element.parsedHedString.tagGroups) {
        const [event, eventIssues] = Event.createEvent(group, element)
        if (eventIssues.length > 0) {
          return [[], eventIssues]
        }
        if (event) {
          eventList.push(event)
        }
      }
    }
    eventList.sort((a, b) => a.onset - b.onset)
    return [eventList, []]
  }

  public validate(eventList: Event[]): BidsHedIssue[] {
    const currentMap = new Map<string, Event>()
    for (const event of eventList) {
      if (!currentMap.has(event.defName)) {
        if (event.type === 'Offset' || event.type === 'Inset') {
          return [
            BidsHedIssue.fromHedIssue(
              generateIssue('inactiveOnset', { tag: event.type, definition: event.defName }),
              event.file,
              { tsvLine: event.tsvLine },
            ),
          ]
        }
        currentMap.set(event.defName, event)
        continue
      }
      const issues = this._resolveConflicts(currentMap, event)
      if (issues.length > 0) {
        return issues
      }
    }
    return []
  }

  private _resolveConflicts(currentMap: Map<string, Event>, event: Event): BidsHedIssue[] {
    const currentEvent = currentMap.get(event.defName)
    if (currentEvent === undefined) {
      IssueError.generateAndThrowInternalError('currentMap is resolving a conflict with an undefined event')
    }
    // Make sure that these events are not at the same time
    if (Math.abs(currentEvent.onset - event.onset) < EventManager.TOLERANCE) {
      return [
        BidsHedIssue.fromHedIssue(
          generateIssue('simultaneousDuplicateEvents', {
            tagGroup1: event.group.originalTag,
            onset1: event.onset.toString(),
            tsvLine1: event.tsvLine,
            tagGroup2: currentEvent.group.originalTag,
            onset2: currentEvent.onset.toString(),
            tsvLine2: currentEvent.tsvLine,
          }),
          event.file,
        ),
      ]
    }

    if (event.type === 'Onset') {
      currentMap.set(event.defName, event)
    } else if (event.type === 'Inset' && currentEvent.type !== 'Offset') {
      currentMap.set(event.defName, event)
    } else if (event.type === 'Offset' && currentEvent.type !== 'Offset') {
      currentMap.set(event.defName, event)
    }

    return []
  }
}
