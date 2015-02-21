(ns hardmode-core.src.core
  (:require
    [redis]
    [wisp.runtime :refer [cons first rest]]
    [mori :refer [list hash-map is-map conj each into reduce]]))


(defn assert [condition message]
  (if (not condition) (throw (Error. message))))


;(defn execute-body!
  ;([body]
    ;(execute-body! (hash-map) body))
  ;([context body]
    ;(console.log "BODY" body (into (list) [body]))
    ;(loop [context context
           ;members (if (> body.length 0) (into (list) body) (list))]
      ;(console.log "MEMBERS" members)
      ;(assert (is-map context) "context is not a map?!")
      ;(console.log "\n" context)
      ;(if (first members)
        ;(recur ((first members) context) (rest members))
        ;context))))


(defn execute-body!
  [context-or-member & body]

  ; consistent format for arguments:
  ; if `context-or-member` is a map (TODO not a function) then
  ; use it as a context object; otherwise assume it's a member
  (let [member-list     (if (> body.length 0) (into (list) body) (list))
        has-context     (is-map context-or-member)
        context         (if has-context
                          context-or-member
                          (hash-map))
        members         (if has-context
                          member-list
                          (conj member-list context-or-member))]

    ; run context object through each function of the body
    ; members have the choice to either return an optionally
    ; modified context, or in turn call `execute-body!` themselves

    ; lazy way
    ;(reduce (fn [ctx member]
      ;(assert (is-map ctx "context is not a hash-map?!"))
      ;(console.log "\n" ctx)
      ;(member ctx)) context members)))

    ; non-lazy way
    (loop [context context
           members members]
      (assert (is-map context) "context is not a map?!")
      ;(console.log "\n" context)
      (if (mori.first members)
        (recur ((mori.first members) context) (mori.rest members))
        context))))
